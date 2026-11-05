import io
import tempfile
import zipfile
from pathlib import Path

from django.core.files.base import ContentFile
from django.core.management import call_command
from django.test import TestCase, override_settings

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
