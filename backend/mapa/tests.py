from django.test import SimpleTestCase, TestCase
from rest_framework.test import APITestCase

from .estadisticas import calcular_estadisticas
from .models import Region, Viaje, Visita
from .notion import Destino, Lugar, Place, parsear_destino, parsear_lugar
from .sincronizacion import planificar_visitas
from .ubicacion import Ubicacion, area_bbox_km2, normalizar
from .views import calcular_estados


class CalcularEstadosTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.arg = Region.objects.create(nivel='pais', codigo='ARG', nombre='Argentina')
        cls.salta = Region.objects.create(nivel='provincia', codigo='AR-A', nombre='Salta', padre=cls.arg)
        cls.tucuman = Region.objects.create(nivel='provincia', codigo='AR-T', nombre='Tucumán', padre=cls.arg)
        cls.per = Region.objects.create(nivel='pais', codigo='PER', nombre='Perú')
        cls.cusco = Region.objects.create(nivel='provincia', codigo='PE-CUS', nombre='Cusco', padre=cls.per)

    def test_el_estado_sube_al_pais_con_la_mayor_intensidad(self):
        viaje = Viaje.objects.create(nombre='NOA')
        Visita.objects.create(viaje=viaje, region=self.tucuman, tipo_presencia='paso')
        Visita.objects.create(viaje=viaje, region=self.salta, tipo_presencia='estadia')

        self.assertEqual(calcular_estados(), {'AR-T': 'paso', 'AR-A': 'estadia', 'ARG': 'estadia'})

    def test_visita_no_realizada_es_deseo(self):
        viaje = Viaje.objects.create(nombre='Perú', estado=Viaje.Estado.INVESTIGANDO)
        Visita.objects.create(viaje=viaje, region=self.cusco, realizada=False)

        self.assertEqual(calcular_estados(), {'PE-CUS': 'deseo', 'PER': 'deseo'})

    def test_lo_visitado_le_gana_al_deseo(self):
        Visita.objects.create(viaje=Viaje.objects.create(nombre='Volver'), region=self.salta, realizada=False)
        Visita.objects.create(viaje=None, region=self.salta, tipo_presencia='transito')

        self.assertEqual(calcular_estados()['AR-A'], 'transito')


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


class AnexarTests(SimpleTestCase):
    def test_las_islas_pasan_a_ser_parte_de_argentina(self):
        import geopandas as gpd
        from shapely.geometry import box

        from .management.commands.descargar_natural_earth import normalizar_paises

        paises = gpd.GeoDataFrame(
            {
                'ADM0_A3': ['ARG', 'FLK', 'SGS', 'CHL'],
                'NAME_ES': ['Argentina', 'Islas Malvinas', 'Georgias', 'Chile'],
                'CONTINENT': ['South America'] * 4,
            },
            geometry=[box(-70, -55, -55, -22), box(-61, -53, -57, -51), box(-38, -55, -26, -54), box(-75, -56, -70, -17)],
            crs='EPSG:4326',
        )
        resultado = normalizar_paises(paises)

        self.assertEqual(sorted(resultado['codigo']), ['ARG', 'CHL'])
        argentina = resultado.set_index('codigo').geometry['ARG']
        self.assertTrue(argentina.contains(box(-60, -52, -59, -51.5)))   # Malvinas
        self.assertTrue(argentina.contains(box(-37, -54.5, -36, -54.2)))  # Georgias del Sur


class UtilidadesTests(SimpleTestCase):
    def test_normalizar(self):
        self.assertEqual(normalizar('  Perú '), 'peru')
        self.assertEqual(normalizar('Túnez'), normalizar('Tunez'))

    def test_area_bbox(self):
        # 1° x 1° en el ecuador: ~111 km x 111 km
        self.assertAlmostEqual(area_bbox_km2(['0', '1', '0', '1']), 12321, delta=5)


class ApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.arg = Region.objects.create(nivel='pais', codigo='ARG', nombre='Argentina')
        cls.salta = Region.objects.create(nivel='provincia', codigo='AR-A', nombre='Salta', padre=cls.arg)
        cls.notion = Viaje.objects.create(nombre='Salta - Jujuy', estado='hecho', notion_id='abc')
        cls.visita_notion = Visita.objects.create(viaje=cls.notion, region=cls.salta, desde_notion=True)

    def test_crear_viaje_y_visita_por_codigo_de_region(self):
        viaje = self.client.post('/api/viajes/', {'nombre': 'NOA 2027', 'estado': 'deseo'}, format='json')
        self.assertEqual(viaje.status_code, 201, viaje.data)

        visita = self.client.post('/api/visitas/', {'viaje': viaje.data['id'], 'region': 'AR-A',
                                                    'tipo_presencia': 'paso'}, format='json')
        self.assertEqual(visita.status_code, 201, visita.data)
        self.assertEqual(visita.data['region_nombre'], 'Salta')
        self.assertFalse(visita.data['desde_notion'])

        detalle = self.client.get(f'/api/viajes/{viaje.data["id"]}/')
        self.assertEqual([v['region'] for v in detalle.data['visitas']], ['AR-A'])

    def test_visita_sin_viaje(self):
        respuesta = self.client.post('/api/visitas/', {'viaje': None, 'region': 'ARG'}, format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(len(self.client.get('/api/visitas/?viaje=ninguno').data), 1)

    def test_region_inexistente(self):
        respuesta = self.client.post('/api/visitas/', {'region': 'XX-ZZ'}, format='json')
        self.assertEqual(respuesta.status_code, 400)

    def test_fecha_fin_anterior_al_inicio(self):
        respuesta = self.client.post('/api/viajes/', {'nombre': 'X', 'fecha_inicio': '2026-05-10',
                                                      'fecha_fin': '2026-05-01'}, format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('fecha_fin', respuesta.data)

    def test_viaje_de_notion_admite_fechas_y_notas_pero_no_nombre(self):
        url = f'/api/viajes/{self.notion.id}/'
        self.assertEqual(self.client.patch(url, {'notas': 'Hermoso', 'fecha_inicio': '2025-01-10'},
                                           format='json').status_code, 200)
        self.assertEqual(self.client.patch(url, {'nombre': 'Otro'}, format='json').status_code, 400)
        self.assertEqual(self.client.delete(url).status_code, 403)

    def test_visita_de_notion_es_de_solo_lectura(self):
        url = f'/api/visitas/{self.visita_notion.id}/'
        self.assertEqual(self.client.patch(url, {'tipo_presencia': 'paso'}, format='json').status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)
        self.assertTrue(Visita.objects.filter(id=self.visita_notion.id).exists())


class EstadisticasTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.arg = Region.objects.create(nivel='pais', codigo='ARG', nombre='Argentina', area_km2=1000,
                                        continente='South America')
        Region.objects.create(nivel='pais', codigo='CHL', nombre='Chile', area_km2=500, continente='South America')
        cls.jujuy = Region.objects.create(nivel='provincia', codigo='AR-Y', nombre='Jujuy', padre=cls.arg, area_km2=100)
        cls.salta = Region.objects.create(nivel='provincia', codigo='AR-A', nombre='Salta', padre=cls.arg, area_km2=200)
        cls.tilcara = Region.objects.create(nivel='departamento', codigo='AR-38094', nombre='Tilcara',
                                            padre=cls.jujuy, area_km2=10)
        cls.capital = Region.objects.create(nivel='departamento', codigo='AR-66028', nombre='Capital',
                                            padre=cls.salta, area_km2=5)

    def test_no_cuenta_dos_veces_y_usa_la_region_mas_grande_visitada(self):
        Visita.objects.create(region=self.jujuy)
        Visita.objects.create(region=self.tilcara)   # ya incluida en Jujuy
        Visita.objects.create(region=self.capital)   # solo el departamento, no toda Salta
        Visita.objects.create(region=self.salta, realizada=False)  # un deseo no suma

        datos = calcular_estadisticas()
        self.assertEqual(datos['km2_visitados'], 105)
        self.assertEqual(datos['porcentaje_mundo'], 7.0)  # 105 / (1000 + 500)
        self.assertEqual(datos['paises_visitados'], 1)
        self.assertEqual(datos['continentes'], [{'continente': 'Sudamérica', 'visitados': 1, 'total': 2}])
        self.assertEqual(datos['paises'], [{
            'codigo': 'ARG', 'nombre': 'Argentina', 'km2_visitados': 105, 'porcentaje': 10.5,
            'provincias_visitadas': 2, 'provincias_total': 2,
        }])
