import io
from unittest import mock

from django.core.management import call_command
from django.test import SimpleTestCase, TestCase, override_settings

from ..models import Region, Viaje, Visita
from ..notion import Destino, Lugar, Place, parsear_destino, parsear_lugar
from ..sincronizacion import planificar_visitas
from ..ubicacion import Ubicacion, area_bbox_km2, normalizar


def pagina(notion_id, **props):
    return {'id': notion_id, 'properties': props}


def titulo(texto):
    return {'type': 'title', 'title': [{'plain_text': texto}]}


def opcion(tipo, nombre):
    return {'type': tipo, tipo: {'name': nombre} if nombre else None}


def relacion(*ids):
    return {'type': 'relation', 'relation': [{'id': i} for i in ids]}


def place_prop(lat, lon, nombre=''):
    return {'type': 'place', 'place': {'lat': lat, 'lon': lon, 'name': nombre}}


class ParseoNotionTests(SimpleTestCase):
    def test_destino(self):
        destino = parsear_destino(pagina(
            'd1', Name=titulo('Salta - Jujuy'), Status=opcion('status', 'Done!'),
            Place={'type': 'place', 'place': None}, Lugares=relacion('l1', 'l2'),
        ))
        self.assertEqual(destino, Destino('d1', 'Salta - Jujuy', 'hecho', None, ['l1', 'l2']))

    def test_lugar_con_place_y_estado_vacio(self):
        lugar = parsear_lugar(pagina(
            'l1', Lugar=titulo('Tilcara'), Estado=opcion('select', None),
            Place=place_prop(-23.57, -65.39, 'Tilcara, Argentina'), Viaje=relacion(),
        ))
        self.assertIsNone(lugar.visitado)
        self.assertEqual(lugar.place, Place(-23.57, -65.39, 'Tilcara, Argentina'))

    def test_status_desconocido_cuenta_como_deseo(self):
        destino = parsear_destino(pagina('d1', Name=titulo('X'), Status=opcion('status', 'Nuevo'), Lugares=relacion()))
        self.assertEqual(destino.estado, 'deseo')


class UbicadorFalso:
    """Coordenadas: lat < -30 es Buenos Aires, si no Jujuy (o su departamento Tilcara si se pide detalle).
    Nombres: un diccionario fijo."""

    nombres = {'Peru': 'PER', 'Tucuman': 'AR-T'}

    def por_coordenadas(self, lat, lon, detallar=False):
        if lat < -30:
            return Ubicacion('AR-B', 'place')
        return Ubicacion('AR-38084' if detallar else 'AR-Y', 'place')

    def por_nombre(self, nombre):
        codigo = self.nombres.get(nombre)
        return Ubicacion(codigo, 'nombre') if codigo else None


class PlanificarVisitasTests(SimpleTestCase):
    def planificar(self, destinos, lugares):
        visitas, sin_ubicar = planificar_visitas(destinos, lugares, UbicadorFalso())
        return {(v.viaje_notion_id, v.codigo): v.realizada for v in visitas}, sin_ubicar

    def test_lugares_del_mismo_viaje_y_region_se_unifican(self):
        destino = Destino('d1', 'NOA', 'hecho', None, ['l1', 'l2'])
        lugares = [
            Lugar('l1', 'Tilcara', True, Place(-23.5, -65.4, ''), ['d1']),
            Lugar('l2', 'Tilcara pueblo', False, Place(-23.6, -65.4, ''), ['d1']),
        ]
        self.assertEqual(self.planificar([destino], lugares), ({('d1', 'AR-38084'): True}, []))

    def test_los_lugares_bajan_a_departamento_y_los_destinos_no(self):
        con_lugar = Destino('d1', 'NOA', 'hecho', None, ['l1'])
        sin_lugar = Destino('d2', 'Jujuy', 'deseo', Place(-24.2, -65.3, 'Jujuy'))
        lugar = Lugar('l1', 'Tilcara', True, Place(-23.5, -65.4, ''), ['d1'])
        visitas, _ = self.planificar([con_lugar, sin_lugar], [lugar])
        self.assertEqual(visitas, {('d1', 'AR-38084'): True, ('d2', 'AR-Y'): False})

    def test_el_estado_del_lugar_manda_sobre_el_del_destino(self):
        # Destino "In progress" con su lugar "Planeado": es un deseo, no una visita.
        destino = Destino('d1', 'Tucuman', 'en_curso', None, ['l1'])
        lugar = Lugar('l1', 'Tucuman', False, None, ['d1'])
        self.assertEqual(self.planificar([destino], [lugar]), ({('d1', 'AR-T'): False}, []))

    def test_sin_lugares_usa_el_nombre_y_solo_done_es_visitado(self):
        destinos = [Destino('d1', 'Peru', 'deseo', None), Destino('d2', 'Migrate', 'en_curso', None)]
        self.assertEqual(self.planificar(destinos, []), ({('d1', 'PER'): False}, ['Migrate']))

    def test_lugar_sin_viaje_es_visita_sin_viaje(self):
        lugar = Lugar('l1', 'Mar del Plata', True, Place(-38.0, -57.5, ''), [])
        self.assertEqual(self.planificar([], [lugar]), ({(None, 'AR-B'): True}, []))


class UtilidadesTests(SimpleTestCase):
    def test_normalizar(self):
        self.assertEqual(normalizar('  Perú '), 'peru')
        self.assertEqual(normalizar('Túnez'), normalizar('Tunez'))

    def test_area_bbox(self):
        # 1° x 1° en el ecuador: ~111 km x 111 km
        self.assertAlmostEqual(area_bbox_km2(['0', '1', '0', '1']), 12321, delta=5)


@override_settings(NOTION_DATABASE_ID='destinos', NOTION_TOKEN='x')
class SincronizarNotionTests(TestCase):
    """El comando entero contra una base real: borra y recrea visitas, así que no puede tocar las cargadas a mano."""

    @classmethod
    def setUpTestData(cls):
        cls.peru = Region.objects.create(nivel='pais', codigo='PER', nombre='Perú')
        cls.arg = Region.objects.create(nivel='pais', codigo='ARG', nombre='Argentina')
        cls.tucuman = Region.objects.create(nivel='provincia', codigo='AR-T', nombre='Tucumán', padre=cls.arg)
        cls.jujuy = Region.objects.create(nivel='provincia', codigo='AR-Y', nombre='Jujuy', padre=cls.arg)

    def sincronizar(self, destinos, **opciones):
        salida = io.StringIO()
        ruta = 'mapa.management.commands.sincronizar_notion'
        with mock.patch(f'{ruta}.ClienteNotion') as cliente, \
                mock.patch(f'{ruta}.Ubicador', return_value=UbicadorFalso()), \
                mock.patch(f'{ruta}.parsear_destino', side_effect=lambda d: d), \
                mock.patch(f'{ruta}.parsear_lugar', side_effect=lambda lugar: lugar):
            base = {'properties': {'Lugares': {'relation': {'database_id': 'lugares'}}}}
            cliente.return_value.base.return_value = base
            cliente.return_value.filas.side_effect = lambda base: destinos if base == 'destinos' else []
            call_command('sincronizar_notion', stdout=salida, **opciones)
        return salida.getvalue()

    def test_crea_los_viajes_y_sus_visitas(self):
        self.sincronizar([Destino('d1', 'Peru', 'hecho', None), Destino('d2', 'Tucuman', 'deseo', None)])
        peru = Visita.objects.get(viaje__notion_id='d1')
        self.assertEqual((peru.region.codigo, peru.realizada, peru.desde_notion), ('PER', True, True))
        tucuman = Visita.objects.get(viaje__notion_id='d2')
        self.assertEqual((tucuman.region.codigo, tucuman.realizada), ('AR-T', False))

    def test_regenera_sus_visitas_y_respeta_las_cargadas_a_mano(self):
        self.sincronizar([Destino('d1', 'Peru', 'hecho', None)])
        viaje = Viaje.objects.get(notion_id='d1')
        a_mano = Visita.objects.create(viaje=viaje, region=self.jujuy, tipo_presencia='paso')
        sin_viaje = Visita.objects.create(region=self.tucuman)

        # El destino ahora cae en Jujuy: la visita a Perú se va y la de Jujuy sigue siendo la cargada a mano.
        self.sincronizar([Destino('d1', 'Peru', 'hecho', Place(-23.5, -65.4, 'Tilcara'))])

        self.assertFalse(Visita.objects.filter(region=self.peru).exists())
        a_mano.refresh_from_db()
        self.assertEqual((a_mano.tipo_presencia, a_mano.desde_notion), ('paso', False))
        self.assertEqual(Visita.objects.filter(viaje=viaje).count(), 1)
        self.assertTrue(Visita.objects.filter(id=sin_viaje.id).exists())

    def test_actualiza_nombre_y_estado_y_conserva_las_notas(self):
        self.sincronizar([Destino('d1', 'Peru', 'deseo', None)])
        Viaje.objects.filter(notion_id='d1').update(notas='Llevar abrigo')
        self.sincronizar([Destino('d1', 'Peru', 'hecho', None)])
        viaje = Viaje.objects.get(notion_id='d1')
        self.assertEqual((viaje.estado, viaje.notas), ('hecho', 'Llevar abrigo'))

    def test_un_destino_que_desaparece_de_notion_no_se_borra(self):
        self.sincronizar([Destino('d1', 'Peru', 'hecho', None)])
        salida = self.sincronizar([])
        self.assertTrue(Viaje.objects.filter(notion_id='d1').exists())
        self.assertIn('ya no está en Notion', salida)

    def test_dry_run_no_guarda_nada(self):
        self.sincronizar([Destino('d1', 'Peru', 'hecho', None)], dry_run=True)
        self.assertFalse(Viaje.objects.exists())
        self.assertFalse(Visita.objects.exists())
