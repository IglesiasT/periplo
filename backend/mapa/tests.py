import json
import shutil
import tempfile
from pathlib import Path
from unittest import mock

import pandas as pd

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APITestCase

from .estadisticas import calcular_estadisticas
from .fotos import ErrorFoto, leer_foto
from .logros import Logro, calcular_logros, continentes, grupos, provincias_de, regiones
from .models import EntidadEpoca, EntidadPoliticaHistorica, FichaRegion, Foto, Region, RegionEpoca, Viaje, Visita
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


class EncuadreTests(SimpleTestCase):
    def test_una_sola_parte_es_su_recuadro(self):
        from shapely.geometry import box

        from .geodatos import encuadre

        self.assertEqual(encuadre(box(-70, -55, -55, -22)), [-70, -55, -55, -22])

    def test_suma_las_partes_cercanas_encadenadas_y_deja_afuera_las_lejanas(self):
        from shapely.geometry import MultiPolygon, box

        from .geodatos import encuadre

        continente = box(-70, -52, -55, -22)
        tierra_del_fuego = box(-68, -55, -64, -52.5)  # a medio grado del continente
        encadenada = box(-66, -61, -65, -59)  # a 7° del continente pero a 4° de Tierra del Fuego
        isla_lejana = box(-110, -28, -109, -27)  # como la Isla de Pascua para Chile
        recuadro = encuadre(MultiPolygon([continente, tierra_del_fuego, encadenada, isla_lejana]))
        self.assertEqual(recuadro, [-70, -61, -55, -22])

    def test_si_cruza_el_antimeridiano_queda_la_parte_mas_grande(self):
        from shapely.geometry import MultiPolygon, box

        from .geodatos import encuadre

        # Como Rusia: el continente hasta 180° y Chukotka del otro lado, a -179°.
        rusia = MultiPolygon([box(30, 45, 180, 75), box(-180, 64, -170, 70)])
        self.assertEqual(encuadre(rusia, distancia=500), [30, 45, 180, 75])

    def test_unir_recuadros(self):
        from .geodatos import unir_recuadros

        self.assertEqual(unir_recuadros([[-70, -40, -66, -32], [-72, -34, -70, -32]]), [-72, -40, -66, -32])
        self.assertIsNone(unir_recuadros([]))


class EncuadreApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        Region.objects.create(nivel='provincia', codigo='AR-M', nombre='Mendoza', encuadre=[-70.6, -37.6, -66.5, -32])
        Region.objects.create(nivel='provincia', codigo='CL-RM', nombre='Santiago', encuadre=[-71.7, -34.3, -69.8, -32.9])
        Region.objects.create(nivel='provincia', codigo='AR-X', nombre='Sin calcular')

    def test_une_las_regiones_pedidas_e_ignora_las_desconocidas(self):
        respuesta = self.client.get('/api/encuadre/', {'codigo': ['AR-M', 'CL-RM', 'XX-NADA', 'AR-X']})
        self.assertEqual(respuesta.data, {'limites': [-71.7, -37.6, -66.5, -32]})

    def test_sin_regiones_conocidas(self):
        self.assertEqual(self.client.get('/api/encuadre/', {'codigo': 'XX-NADA'}).data, {'limites': None})


class NormalizarProvinciasTests(SimpleTestCase):
    def test_un_fragmento_sin_nombre_no_queda_como_nan(self):
        import geopandas as gpd
        from shapely.geometry import box

        from .management.commands.descargar_natural_earth import normalizar_provincias

        provincias = gpd.GeoDataFrame(
            {'iso_3166_2': ['CO-ANT', 'CO-X01~'], 'adm1_code': ['COL-1', 'COL+99?'],
             'name': ['Antioquia', None], 'adm0_a3': ['COL', 'COL']},
            geometry=[box(0, 0, 1, 1), box(2, 2, 3, 3)], crs='EPSG:4326',
        )
        resultado = normalizar_provincias(provincias).set_index('codigo')
        self.assertEqual(resultado.at['COL+99?', 'nombre'], 'Sin nombre')
        self.assertEqual(resultado.at['CO-ANT', 'nombre'], 'Antioquia')


class DescargarHistoriaTests(SimpleTestCase):
    def test_anio_de_cada_snapshot(self):
        from .management.commands.descargar_historia import anio_de

        self.assertEqual(anio_de('world_1800.geojson'), 1800)
        self.assertEqual(anio_de('world_bc500.geojson'), -500)
        self.assertIsNone(anio_de('places.geojson'))

    def test_normalizar_disuelve_por_nombre_y_descarta_lo_que_no_tiene(self):
        import geopandas as gpd
        from shapely.geometry import box

        from .management.commands.descargar_historia import normalizar

        crudo = gpd.GeoDataFrame(
            {
                'NAME': ['Spain', 'Spain', 'Viceroyalty of New Spain', None],
                'SUBJECTO': ['Spain', 'Spain', 'Spain', None],
            },
            geometry=[box(-9, 36, 3, 43), box(1, 38, 4, 40), box(-117, 15, -87, 32), box(0, 0, 1, 1)],
            crs='EPSG:4326',
        )
        resultado = normalizar(crudo).set_index('nombre')

        self.assertEqual(sorted(resultado.index), ['Spain', 'Viceroyalty of New Spain'])
        self.assertTrue(resultado.geometry['Spain'].contains(box(3.5, 38.5, 3.9, 39.5)))  # Baleares
        self.assertEqual(resultado.at['Spain', 'sujeta_a'], '')
        self.assertEqual(resultado.at['Viceroyalty of New Spain', 'sujeta_a'], 'Spain')


class CruzarHistoriaTests(SimpleTestCase):
    def cruzar(self, regiones: dict, entidades: dict, **kwargs):
        import geopandas as gpd

        from .historia import cruzar, preparar_regiones

        regiones = preparar_regiones(gpd.GeoDataFrame(
            {'codigo': list(regiones)}, geometry=list(regiones.values()), crs='EPSG:4326'))
        snapshot = gpd.GeoDataFrame({'nombre': list(entidades)}, geometry=list(entidades.values()), crs='EPSG:4326')
        return cruzar(regiones, snapshot, **kwargs)

    def test_region_entre_dos_entidades(self):
        from shapely.geometry import box

        resultado = self.cruzar({'R': box(0, 0, 2, 1)}, {'A': box(-5, -5, 0.5, 5), 'B': box(0.5, -5, 5, 5)})

        porcentajes = dict(zip(resultado['entidad'], resultado['porcentaje']))
        self.assertAlmostEqual(porcentajes['A'], 25, delta=0.5)
        self.assertAlmostEqual(porcentajes['B'], 75, delta=0.5)

    def test_el_porcentaje_ignora_la_parte_que_cae_fuera_de_toda_entidad(self):
        from shapely.geometry import box

        # La costa del snapshot deja afuera media región: igual cuenta como 100% de A.
        resultado = self.cruzar({'R': box(0, 0, 2, 1)}, {'A': box(-5, -5, 1, 5)})

        self.assertEqual(list(resultado['entidad']), ['A'])
        self.assertAlmostEqual(resultado['porcentaje'][0], 100)

    def test_descarta_las_entidades_por_debajo_del_umbral(self):
        from shapely.geometry import box

        resultado = self.cruzar({'R': box(0, 0, 10, 1)}, {'A': box(-5, -5, 9.95, 5), 'B': box(9.95, -5, 15, 5)})

        self.assertEqual(list(resultado['entidad']), ['A'])

    def test_isla_sin_entidad_toma_la_mas_cercana_si_esta_cerca(self):
        from shapely.geometry import box

        entidades = {'A': box(-5, -5, 0, 5)}
        resultado = self.cruzar({'Cerca': box(0.2, 0, 0.3, 0.1), 'Lejos': box(10, 0, 11, 1)}, entidades)

        self.assertEqual(list(resultado['codigo']), ['Cerca'])
        self.assertEqual(resultado['entidad'][0], 'A')
        self.assertTrue(pd.isna(resultado['porcentaje'][0]))


class DescribirEntidadesTests(SimpleTestCase):
    def describir(self, entidades: dict, **kwargs):
        import geopandas as gpd

        from .historia import describir_entidades

        snapshot = gpd.GeoDataFrame({'nombre': list(entidades)}, geometry=list(entidades.values()), crs='EPSG:4326')
        return describir_entidades(snapshot, **kwargs).set_index('nombre')

    def test_el_hash_es_el_mismo_que_en_el_frontend(self):
        from .historia import hash_nombre

        # Valores de `hash` en frontend/src/historia.ts.
        self.assertEqual(hash_nombre('Spain'), 3872515054)
        self.assertEqual(hash_nombre('Viceroyalty of the Río de la Plata'), 2840156130)
        self.assertEqual(hash_nombre('Anishinabewaki ᐊᓂᔑᓈᐯᐗᑭ'), 1926154443)

    def test_el_rotulo_cae_adentro_de_la_parte_mas_grande(self):
        from shapely.geometry import MultiPolygon, Point, box

        entidades = self.describir({'Imperio': MultiPolygon([box(0, 0, 10, 4), box(20, 20, 21, 21)])})
        fila = entidades.loc['Imperio']
        self.assertTrue(box(0, 0, 10, 4).contains(Point(fila.lon, fila.lat)))
        self.assertGreater(fila.area_km2, 0)

    def test_vecinas_con_distinto_tono_y_sin_conflicto_se_conserva_el_de_siempre(self):
        from shapely.geometry import box

        from .historia import hash_nombre

        # Con 2 tonos, tres entidades en fila: las vecinas no pueden repetir.
        entidades = self.describir({
            'A': box(0, 0, 10, 10), 'B': box(10, 0, 12, 10), 'C': box(12, 0, 14, 10), 'Lejos': box(50, 50, 51, 51),
        }, cantidad_tonos=2)
        self.assertNotEqual(entidades.at['A', 'tono'], entidades.at['B', 'tono'])
        self.assertNotEqual(entidades.at['B', 'tono'], entidades.at['C', 'tono'])
        # La más grande y la que no tiene vecinas se quedan con su color de siempre.
        self.assertEqual(entidades.at['A', 'tono'], hash_nombre('A') % 2)
        self.assertEqual(entidades.at['Lejos', 'tono'], hash_nombre('Lejos') % 2)

    def test_casi_tocarse_tambien_es_ser_vecinas(self):
        from shapely.geometry import box

        # Un hueco de 0,05° entre dos fronteras aproximadas: siguen siendo vecinas.
        entidades = self.describir({'A': box(0, 0, 10, 10), 'B': box(10.05, 0, 12, 10)}, cantidad_tonos=2)
        self.assertNotEqual(entidades.at['A', 'tono'], entidades.at['B', 'tono'])


class EpocasApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        arg = Region.objects.create(nivel='pais', codigo='ARG', nombre='Argentina')
        salta = Region.objects.create(nivel='provincia', codigo='AR-A', nombre='Salta', padre=arg)
        jujuy = Region.objects.create(nivel='provincia', codigo='AR-Y', nombre='Jujuy', padre=arg)
        cusco = Region.objects.create(nivel='provincia', codigo='PE-CUS', nombre='Cusco')
        rio = EntidadPoliticaHistorica.objects.create(nombre='Viceroyalty of the Río de la Plata', color='#c0a060')
        peru = EntidadPoliticaHistorica.objects.create(nombre='Viceroyalty of Peru')
        RegionEpoca.objects.create(region=salta, anio=1800, entidad=rio, porcentaje_superficie=96.6)
        RegionEpoca.objects.create(region=salta, anio=1800, entidad=peru, porcentaje_superficie=3.4)
        RegionEpoca.objects.create(region=jujuy, anio=1800, entidad=rio, porcentaje_superficie=70)
        RegionEpoca.objects.create(region=jujuy, anio=1800, entidad=peru, porcentaje_superficie=30)
        RegionEpoca.objects.create(region=cusco, anio=1800, entidad=peru, porcentaje_superficie=None)
        RegionEpoca.objects.create(region=salta, anio=-500, entidad=peru, porcentaje_superficie=100)
        Visita.objects.create(region=salta)
        Visita.objects.create(region=cusco, realizada=False)

    def test_anios_disponibles(self):
        self.assertEqual(self.client.get('/api/historia/').data, [-500, 1800])

    def test_regiones_con_su_entidad_principal(self):
        datos = self.client.get('/api/historia/1800/').data
        self.assertEqual(datos['regiones'], {
            'AR-A': 'Viceroyalty of the Río de la Plata',
            'AR-Y': 'Viceroyalty of the Río de la Plata',
            'PE-CUS': 'Viceroyalty of Peru',
        })
        self.assertEqual(datos['colores'], {'Viceroyalty of the Río de la Plata': '#c0a060'})

    def test_pisadas_ignoran_el_roce_de_frontera_y_los_deseos(self):
        # Salta toca Perú en un 3,4%: no cuenta. Cusco es solo un deseo.
        datos = self.client.get('/api/historia/1800/').data
        self.assertEqual(datos['pisadas'], [
            {'entidad': 'Viceroyalty of the Río de la Plata', 'regiones': [{'codigo': 'AR-A', 'nombre': 'Salta'}]},
        ])

    def test_pisadas_cuentan_las_entidades_con_parte_grande_de_la_region(self):
        Visita.objects.create(region=Region.objects.get(codigo='AR-Y'))
        entidades = [p['entidad'] for p in self.client.get('/api/historia/1800/').data['pisadas']]
        self.assertEqual(entidades, ['Viceroyalty of the Río de la Plata', 'Viceroyalty of Peru'])

    def test_anio_antes_de_cristo(self):
        datos = self.client.get('/api/historia/-500/').data
        self.assertEqual(datos['regiones'], {'AR-A': 'Viceroyalty of Peru'})

    def test_anio_sin_datos(self):
        self.assertEqual(self.client.get('/api/historia/1234/').status_code, 404)

    def test_rotulos_y_tonos_de_cada_entidad(self):
        rio = EntidadPoliticaHistorica.objects.get(nombre='Viceroyalty of the Río de la Plata')
        isla = EntidadPoliticaHistorica.objects.create(nombre='Island tribes', nombre_es='Tribus isleñas')
        EntidadEpoca.objects.create(anio=1800, entidad=rio, lon=-62, lat=-30, area_km2=4_000_000, tono=0)
        # No ocupa ninguna región, pero igual se rotula y se traduce.
        EntidadEpoca.objects.create(anio=1800, entidad=isla, lon=-40, lat=-20, area_km2=500, tono=3)

        datos = self.client.get('/api/historia/1800/').data
        self.assertEqual([r['entidad'] for r in datos['rotulos']], ['Viceroyalty of the Río de la Plata', 'Island tribes'])
        self.assertEqual(datos['rotulos'][0], {'entidad': 'Viceroyalty of the Río de la Plata', 'lon': -62, 'lat': -30,
                                               'area_km2': 4_000_000})
        self.assertEqual(datos['tonos'], {'Viceroyalty of the Río de la Plata': 0, 'Island tribes': 3})
        self.assertEqual(datos['nombres']['Island tribes'], 'Tribus isleñas')

    def test_nombres_en_castellano_desde_el_json(self):
        from .epocas import aplicar_nombres_es

        # Una traducción que ya no está en el JSON se borra.
        EntidadPoliticaHistorica.objects.filter(nombre='Viceroyalty of Peru').update(nombre_es='Viejo nombre')
        with tempfile.TemporaryDirectory() as directorio:
            ruta = Path(directorio) / 'entidades_es.json'
            ruta.write_text('{"Viceroyalty of the Río de la Plata": "Virreinato del Río de la Plata", '
                            '"Inca Empire": "Imperio incaico"}', encoding='utf-8')
            self.assertEqual(aplicar_nombres_es(ruta), 1)

        datos = self.client.get('/api/historia/1800/').data
        self.assertEqual(datos['nombres'], {'Viceroyalty of the Río de la Plata': 'Virreinato del Río de la Plata'})
        # Las claves siguen siendo el nombre original.
        self.assertEqual(datos['pisadas'][0]['entidad'], 'Viceroyalty of the Río de la Plata')

    def test_el_json_del_repo_es_valido(self):
        from .epocas import NOMBRES_ES

        traducciones = json.loads(NOMBRES_ES.read_text(encoding='utf-8'))
        self.assertTrue(all(isinstance(v, str) and v.strip() for v in traducciones.values()))


class FichasApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.arg = Region.objects.create(nivel='pais', codigo='ARG', nombre='Argentina')
        cls.jujuy = Region.objects.create(nivel='provincia', codigo='AR-Y', nombre='Jujuy', padre=cls.arg)
        cls.tilcara = Region.objects.create(nivel='departamento', codigo='AR-38094', nombre='Tilcara', padre=cls.jujuy)
        viaje = Viaje.objects.create(nombre='Norte', fecha_inicio='2024-07-01')
        Visita.objects.create(viaje=viaje, region=cls.tilcara)
        rio = EntidadPoliticaHistorica.objects.create(nombre='Viceroyalty of the Río de la Plata',
                                                      nombre_es='Virreinato del Río de la Plata')
        peru = EntidadPoliticaHistorica.objects.create(nombre='Viceroyalty of Peru')
        arg = EntidadPoliticaHistorica.objects.create(nombre='Argentina')
        for anio, entidad in [(1700, peru), (1783, rio), (1800, rio), (1900, arg), (2010, arg)]:
            RegionEpoca.objects.create(region=cls.jujuy, anio=anio, entidad=entidad, porcentaje_superficie=100)
        # 1850: hay snapshot pero Jujuy no tiene entidad. Corta el tramo de Argentina en dos.
        RegionEpoca.objects.create(region=cls.tilcara, anio=1850, entidad=arg, porcentaje_superficie=100)
        RegionEpoca.objects.create(region=cls.jujuy, anio=1815, entidad=rio, porcentaje_superficie=60)
        RegionEpoca.objects.create(region=cls.jujuy, anio=1815, entidad=peru, porcentaje_superficie=40)

    def test_region_con_visitas_de_adentro_y_linea_historica(self):
        datos = self.client.get('/api/regiones/AR-Y/').data
        self.assertEqual(datos['nombre'], 'Jujuy')
        self.assertEqual(datos['ancestros'], [{'codigo': 'ARG', 'nombre': 'Argentina'}])
        self.assertIsNone(datos['ficha'])
        self.assertEqual([(v['region_nombre'], v['viaje_nombre']) for v in datos['visitas']], [('Tilcara', 'Norte')])
        self.assertEqual(
            [(t['desde'], t['hasta'], t['nombre']) for t in datos['historia']],
            [(1700, 1700, 'Viceroyalty of Peru'),
             (1783, 1815, 'Virreinato del Río de la Plata'),
             (1900, 2010, 'Argentina')],
        )

    def test_guardar_editar_y_borrar_la_ficha(self):
        respuesta = self.client.put('/api/regiones/AR-Y/ficha/', {'texto': '# Jujuy\nLa quebrada.'}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.client.put('/api/regiones/AR-Y/ficha/', {'texto': 'Otra vez.'}, format='json')
        self.assertEqual(self.client.get('/api/regiones/AR-Y/').data['ficha']['texto'], 'Otra vez.')
        self.assertEqual([f['codigo'] for f in self.client.get('/api/fichas/').data], ['AR-Y'])

        respuesta = self.client.put('/api/regiones/AR-Y/ficha/', {'texto': '  '}, format='json')
        self.assertEqual(respuesta.status_code, 204)
        self.assertFalse(FichaRegion.objects.exists())

    def test_la_ficha_protege_a_su_region(self):
        from django.db.models import ProtectedError

        FichaRegion.objects.create(region=self.tilcara, texto='Pucará')
        with self.assertRaises(ProtectedError):
            self.tilcara.delete()

    def test_region_inexistente(self):
        self.assertEqual(self.client.get('/api/regiones/XX-NADA/').status_code, 404)
        self.assertEqual(self.client.put('/api/regiones/XX-NADA/ficha/', {'texto': 'a'}, format='json').status_code, 404)


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
        cls.arg = Region.objects.create(nivel='pais', codigo='ARG', nombre='Argentina', continente='South America')
        Region.objects.create(nivel='pais', codigo='CHL', nombre='Chile', continente='South America')
        cls.esp = Region.objects.create(nivel='pais', codigo='ESP', nombre='España', continente='Europe')
        Region.objects.create(nivel='pais', codigo='MDV', nombre='Maldivas', continente='Seven seas (open ocean)')
        cls.jujuy = Region.objects.create(nivel='provincia', codigo='AR-Y', nombre='Jujuy', padre=cls.arg)
        cls.salta = Region.objects.create(nivel='provincia', codigo='AR-A', nombre='Salta', padre=cls.arg)
        Region.objects.create(nivel='provincia', codigo='AR-T', nombre='Tucumán', padre=cls.arg)
        cls.tilcara = Region.objects.create(nivel='departamento', codigo='AR-38094', nombre='Tilcara', padre=cls.jujuy)
        cls.madrid = Region.objects.create(nivel='provincia', codigo='ES-M', nombre='Madrid', padre=cls.esp)
        Region.objects.create(nivel='provincia', codigo='ES-B', nombre='Barcelona', padre=cls.esp)

    def test_paises_provincias_y_continentes(self):
        Visita.objects.create(region=self.tilcara)   # suma Jujuy y Argentina
        Visita.objects.create(region=self.jujuy)     # Jujuy no se cuenta dos veces
        Visita.objects.create(region=self.madrid)
        Visita.objects.create(region=self.salta, realizada=False)  # un deseo no suma

        datos = calcular_estadisticas()
        self.assertEqual((datos['paises_visitados'], datos['paises_total']), (2, 4))
        self.assertEqual((datos['provincias_argentinas_visitadas'], datos['provincias_argentinas_total']), (1, 3))
        # El "océano abierto" de Natural Earth no es un continente.
        self.assertEqual((datos['continentes_visitados'], datos['continentes_total']), (2, 7))
        self.assertEqual(datos['paises'], [
            {'codigo': 'ESP', 'nombre': 'España', 'provincias_visitadas': 1, 'provincias_total': 2},
            {'codigo': 'ARG', 'nombre': 'Argentina', 'provincias_visitadas': 1, 'provincias_total': 3},
        ])
        self.assertNotIn('km2_visitados', datos)

    def test_entidades_historicas_con_la_regla_del_panel_de_la_epoca(self):
        rio = EntidadPoliticaHistorica.objects.create(nombre='Viceroyalty of the Río de la Plata')
        peru = EntidadPoliticaHistorica.objects.create(nombre='Viceroyalty of Peru')
        arg = EntidadPoliticaHistorica.objects.create(nombre='Argentina')
        RegionEpoca.objects.create(region=self.jujuy, anio=1800, entidad=rio, porcentaje_superficie=97)
        RegionEpoca.objects.create(region=self.jujuy, anio=1800, entidad=peru, porcentaje_superficie=3)  # roce
        RegionEpoca.objects.create(region=self.jujuy, anio=2010, entidad=arg, porcentaje_superficie=100)
        RegionEpoca.objects.create(region=self.salta, anio=1800, entidad=peru, porcentaje_superficie=100)
        Visita.objects.create(region=self.jujuy)
        Visita.objects.create(region=self.salta, realizada=False)  # un deseo no pisa nada

        self.assertEqual(calcular_estadisticas()['entidades_historicas_pisadas'], 2)


class LogrosTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.arg = Region.objects.create(nivel='pais', codigo='ARG', nombre='Argentina', continente='South America')
        cls.ury = Region.objects.create(nivel='pais', codigo='URY', nombre='Uruguay', continente='South America')
        Region.objects.create(nivel='pais', codigo='ESP', nombre='España', continente='Europe')
        cls.jujuy = Region.objects.create(nivel='provincia', codigo='AR-Y', nombre='Jujuy', padre=cls.arg)
        cls.salta = Region.objects.create(nivel='provincia', codigo='AR-A', nombre='Salta', padre=cls.arg)
        cls.tilcara = Region.objects.create(nivel='departamento', codigo='AR-38094', nombre='Tilcara', padre=cls.jujuy)
        cls.caba = Region.objects.create(nivel='provincia', codigo='AR-C', nombre='Ciudad de Buenos Aires',
                                         padre=cls.arg)

    def avance(self, *logros):
        return {l['id']: (l['cumplidos'], l['total'], l['completo']) for l in calcular_logros(list(logros))}

    def test_un_departamento_cumple_su_provincia_y_un_deseo_no_cuenta(self):
        Visita.objects.create(region=self.tilcara)
        Visita.objects.create(region=self.salta, realizada=False)
        logro = Logro('arg', 'Argentina', '', provincias_de('ARG'))

        [resultado] = calcular_logros([logro])
        self.assertEqual((resultado['cumplidos'], resultado['total']), (1, 3))
        self.assertEqual({o['nombre']: o['cumplido'] for o in resultado['objetivos']},
                         {'Jujuy': True, 'Salta': False, 'Ciudad de Buenos Aires': False})

    def test_un_grupo_se_cumple_con_cualquiera_de_sus_regiones(self):
        Visita.objects.create(region=self.caba)
        Visita.objects.create(region=self.ury)
        plata = Logro('plata', 'Plata', '', grupos({'Argentina': ['AR-C', 'AR-B'], 'Uruguay': ['URY']}))
        self.assertEqual(self.avance(plata), {'plata': (2, 2, True)})

    def test_codigos_que_no_estan_en_la_base_se_ignoran(self):
        Visita.objects.create(region=self.arg)
        logro = Logro('x', 'X', '', regiones('ARG', 'ZZZ'))
        self.assertEqual(self.avance(logro), {'x': (1, 1, True)})

    def test_continentes(self):
        Visita.objects.create(region=self.jujuy)
        logro = Logro('c', 'C', '', continentes('South America', 'Europe', 'Antarctica'))
        [resultado] = calcular_logros([logro])
        self.assertEqual([(o['nombre'], o['cumplido']) for o in resultado['objetivos']],
                         [('Sudamérica', True), ('Europa', False)])

    def test_api(self):
        respuesta = self.client.get('/api/logros/')
        self.assertEqual(respuesta.status_code, 200)
        jurisdicciones = next(l for l in respuesta.json() if l['id'] == 'jurisdicciones')
        self.assertEqual(jurisdicciones['total'], 3)


def jpeg_con_gps(lat_ref='S', lat=(23, 34, 39.6), lon_ref='W', lon=(65, 23, 46.8), fecha='2025:01:10 14:30:00'):
    """JPEG chico generado en memoria con GPS y fecha en el EXIF."""
    import io

    from PIL import ExifTags, Image

    exif = Image.Exif()
    gps = exif.get_ifd(ExifTags.IFD.GPSInfo)
    gps.update({ExifTags.GPS.GPSLatitudeRef: lat_ref, ExifTags.GPS.GPSLatitude: lat,
                ExifTags.GPS.GPSLongitudeRef: lon_ref, ExifTags.GPS.GPSLongitude: lon})
    exif.get_ifd(ExifTags.IFD.Exif)[ExifTags.Base.DateTimeOriginal] = fecha
    salida = io.BytesIO()
    Image.new('RGB', (1200, 800), 'orange').save(salida, 'JPEG', exif=exif)
    return salida.getvalue()


class FotosTests(SimpleTestCase):
    def test_lee_gps_y_fecha_y_genera_miniatura(self):
        datos = leer_foto(jpeg_con_gps())
        self.assertAlmostEqual(datos.lat, -23.5777, places=4)   # Tilcara
        self.assertAlmostEqual(datos.lon, -65.3963, places=4)
        self.assertEqual(datos.tomada_en.strftime('%Y-%m-%d %H:%M'), '2025-01-10 14:30')
        self.assertTrue(datos.miniatura.startswith(b'\xff\xd8'))  # cabecera JPEG

    def test_sin_gps(self):
        import io

        from PIL import Image

        salida = io.BytesIO()
        Image.new('RGB', (10, 10)).save(salida, 'PNG')
        datos = leer_foto(salida.getvalue())
        self.assertEqual((datos.lat, datos.lon, datos.tomada_en), (None, None, None))

    def test_formato_no_soportado(self):
        with self.assertRaises(ErrorFoto):
            leer_foto(b'esto no es una imagen')


MEDIA_DE_PRUEBA = tempfile.mkdtemp(prefix='periplo-test-media-')


@override_settings(MEDIA_ROOT=MEDIA_DE_PRUEBA)
class FotosApiTests(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.addClassCleanup(shutil.rmtree, MEDIA_DE_PRUEBA, ignore_errors=True)

    @classmethod
    def setUpTestData(cls):
        cls.jujuy = Region.objects.create(nivel='provincia', codigo='AR-Y', nombre='Jujuy')
        cls.tilcara = Region.objects.create(nivel='departamento', codigo='AR-38094', nombre='Tilcara', padre=cls.jujuy)
        cls.viaje = Viaje.objects.create(nombre='NOA')

    def subir(self):
        archivo = SimpleUploadedFile('tilcara.jpg', jpeg_con_gps(), content_type='image/jpeg')
        with mock.patch('mapa.api.ubicador_compartido') as ubicador:
            ubicador.return_value.por_coordenadas.return_value = Ubicacion('AR-38094', 'place')
            return self.client.post('/api/fotos/', {'viaje': self.viaje.id, 'archivo': archivo}, format='multipart')

    def test_subir_ubica_la_foto_y_sugiere_la_region(self):
        respuesta = self.subir()
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data['region'], 'AR-38094')
        self.assertFalse(respuesta.data['region_en_viaje'])
        self.assertTrue(respuesta.data['miniatura'].startswith('/media/fotos/miniaturas/'))

    def test_si_el_viaje_tiene_la_provincia_la_foto_se_asocia_a_esa_visita(self):
        visita = Visita.objects.create(viaje=self.viaje, region=self.jujuy)
        respuesta = self.subir()
        self.assertTrue(respuesta.data['region_en_viaje'])
        self.assertEqual(respuesta.data['visita'], visita.id)

    def test_borrar_borra_los_archivos(self):
        foto = Foto.objects.get(id=self.subir().data['id'])
        rutas = [foto.archivo.path, foto.miniatura.path]
        self.assertEqual(self.client.delete(f'/api/fotos/{foto.id}/').status_code, 204)
        self.assertFalse(any(Path(r).exists() for r in rutas))

    def test_borrar_el_viaje_tambien_borra_los_archivos_de_sus_fotos(self):
        foto = Foto.objects.get(id=self.subir().data['id'])
        rutas = [foto.archivo.path, foto.miniatura.path]
        viaje = Viaje.objects.create(nombre='Otro')
        Foto.objects.filter(id=foto.id).update(viaje=viaje)
        self.assertEqual(self.client.delete(f'/api/viajes/{viaje.id}/').status_code, 204)
        self.assertFalse(any(Path(r).exists() for r in rutas))

    def test_archivo_invalido(self):
        archivo = SimpleUploadedFile('foto.heic', b'no soy una imagen', content_type='image/heic')
        respuesta = self.client.post('/api/fotos/', {'archivo': archivo}, format='multipart')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('HEIC', respuesta.data['archivo'][0])
