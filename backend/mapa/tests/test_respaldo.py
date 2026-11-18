import io
import os
import tempfile
import time
import zipfile
from pathlib import Path
from unittest import mock

from django.core.files.base import ContentFile
from django.core.management import call_command
from django.test import TestCase, override_settings

from .. import respaldos
from ..models import FichaRegion, Foto, Region, Viaje, Visita


class RespaldarTests(TestCase):
    def test_ida_y_vuelta(self):
        with tempfile.TemporaryDirectory() as carpeta, override_settings(MEDIA_ROOT=Path(carpeta) / 'media'):
            region = Region.objects.create(nivel='provincia', codigo='AR-Y', nombre='Jujuy')
            viaje = Viaje.objects.create(nombre='NOA', notas='Llevar abrigo')
            Visita.objects.create(viaje=viaje, region=region, tipo_presencia='paso')
            FichaRegion.objects.create(region=region, texto='# Tilcara\nÑandú y cardones.')
            foto = Foto(viaje=viaje, region=region)
            foto.archivo.save('tilcara.jpg', ContentFile(b'bytes de la foto'))
            ruta_foto = foto.archivo.name

            destino = Path(carpeta) / 'respaldos'
            call_command('respaldar', destino=destino, stdout=io.StringIO())
            respaldo = next(destino.glob('periplo-*.zip'))

            # Se pierde todo menos las regiones, que se regeneran con cargar_regiones.
            Viaje.objects.all().delete()
            FichaRegion.objects.all().delete()
            self.assertFalse(Foto.objects.exists())

            restaurado = Path(carpeta) / 'restaurado'
            with zipfile.ZipFile(respaldo) as z:
                z.extractall(restaurado)
            call_command('loaddata', restaurado / 'diario.json', stdout=io.StringIO())

            viaje = Viaje.objects.get(nombre='NOA')
            self.assertEqual(viaje.notas, 'Llevar abrigo')
            self.assertEqual(viaje.visitas.get().tipo_presencia, 'paso')
            self.assertEqual(viaje.visitas.get().region, region)
            self.assertEqual(FichaRegion.objects.get().texto, '# Tilcara\nÑandú y cardones.')
            self.assertEqual(Foto.objects.get().archivo.name, ruta_foto)
            self.assertEqual((restaurado / 'media' / ruta_foto).read_bytes(), b'bytes de la foto')


class RespaldoAutomaticoTests(TestCase):
    def setUp(self):
        carpeta = tempfile.TemporaryDirectory()
        self.addCleanup(carpeta.cleanup)
        self.destino = Path(carpeta.name) / 'respaldos'
        ajustes = override_settings(RESPALDOS_DIR=self.destino, MEDIA_ROOT=Path(carpeta.name) / 'media',
                                    RESPALDO_CADA_DIAS=7, RESPALDOS_A_CONSERVAR=2)
        ajustes.enable()
        self.addCleanup(ajustes.disable)

    def archivo(self, nombre, dias_atras=0):
        self.destino.mkdir(exist_ok=True)
        ruta = self.destino / nombre
        ruta.write_bytes(b'')
        momento = time.time() - dias_atras * 86400
        os.utime(ruta, (momento, momento))
        return ruta

    def test_sin_respaldos_hace_uno(self):
        ruta = respaldos.respaldar_si_hace_falta()
        self.assertTrue(ruta.name.startswith('periplo-auto-'))
        self.assertTrue(zipfile.is_zipfile(ruta))
        self.assertEqual([p.suffix for p in self.destino.iterdir()], ['.zip'])

    def test_con_uno_reciente_no_hace_nada(self):
        self.archivo('periplo-auto-a.zip', dias_atras=6)
        self.assertIsNone(respaldos.respaldar_si_hace_falta())

    def test_un_respaldo_manual_reciente_tambien_cuenta(self):
        self.archivo('periplo-a.zip', dias_atras=1)
        self.assertIsNone(respaldos.respaldar_si_hace_falta())

    def test_con_uno_viejo_hace_otro(self):
        self.archivo('periplo-auto-a.zip', dias_atras=8)
        self.assertIsNotNone(respaldos.respaldar_si_hace_falta())

    def test_borra_los_automaticos_mas_viejos_y_nunca_los_manuales(self):
        manual = self.archivo('periplo-a.zip', dias_atras=100)
        viejo = self.archivo('periplo-auto-a.zip', dias_atras=30)
        medio = self.archivo('periplo-auto-b.zip', dias_atras=20)
        respaldos.respaldar_si_hace_falta()
        self.assertTrue(manual.exists())
        self.assertFalse(viejo.exists())
        self.assertTrue(medio.exists())
        self.assertEqual(len(list(self.destino.glob('periplo-auto-*.zip'))), 2)

    def test_un_respaldo_que_falla_no_tira_abajo_el_arranque(self):
        with mock.patch('mapa.respaldos.respaldar_si_hace_falta', side_effect=OSError('disco lleno')), \
                self.assertLogs('mapa.respaldos', 'ERROR'):
            respaldos.al_arrancar()
