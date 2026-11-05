import json
import tempfile
from pathlib import Path

import pandas as pd
from django.test import SimpleTestCase
from rest_framework.test import APITestCase

from ..models import EntidadEpoca, EntidadPoliticaHistorica, Region, RegionEpoca, Visita


class DescargarHistoriaTests(SimpleTestCase):
    def test_anio_de_cada_snapshot(self):
        from ..management.commands.descargar_historia import anio_de

        self.assertEqual(anio_de('world_1800.geojson'), 1800)
        self.assertEqual(anio_de('world_bc500.geojson'), -500)
        self.assertIsNone(anio_de('places.geojson'))

    def test_normalizar_disuelve_por_nombre_y_descarta_lo_que_no_tiene(self):
        import geopandas as gpd
        from shapely.geometry import box

        from ..management.commands.descargar_historia import normalizar

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

        from ..historia import cruzar, preparar_regiones

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

        from ..historia import describir_entidades

        snapshot = gpd.GeoDataFrame({'nombre': list(entidades)}, geometry=list(entidades.values()), crs='EPSG:4326')
        return describir_entidades(snapshot, **kwargs).set_index('nombre')

    def test_el_hash_no_cambia_nunca_para_que_cada_entidad_conserve_su_color(self):
        from ..historia import hash_nombre

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

        from ..historia import hash_nombre

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
        rio = EntidadPoliticaHistorica.objects.create(nombre='Viceroyalty of the Río de la Plata')
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
        self.assertEqual([r['entidad'] for r in datos['rotulos']],
                         ['Viceroyalty of the Río de la Plata', 'Island tribes'])
        self.assertEqual(datos['rotulos'][0], {'entidad': 'Viceroyalty of the Río de la Plata', 'lon': -62, 'lat': -30,
                                               'area_km2': 4_000_000})
        self.assertEqual(datos['tonos'], {'Viceroyalty of the Río de la Plata': 0, 'Island tribes': 3})
        self.assertEqual(datos['nombres']['Island tribes'], 'Tribus isleñas')

    def test_nombres_en_castellano_desde_el_json(self):
        from ..epocas import aplicar_nombres_es

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
        from ..epocas import NOMBRES_ES

        traducciones = json.loads(NOMBRES_ES.read_text(encoding='utf-8'))
        self.assertTrue(all(isinstance(v, str) and v.strip() for v in traducciones.values()))
