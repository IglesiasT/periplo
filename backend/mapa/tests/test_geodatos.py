import io

from django.test import SimpleTestCase, TestCase

from ..management.commands.cargar_regiones import Command as ComandoCargarRegiones
from ..models import FichaRegion, Region, Visita


class AnexarTests(SimpleTestCase):
    def test_las_islas_pasan_a_ser_parte_de_argentina(self):
        import geopandas as gpd
        from shapely.geometry import box

        from ..management.commands.descargar_natural_earth import normalizar_paises

        paises = gpd.GeoDataFrame(
            {
                'ADM0_A3': ['ARG', 'FLK', 'SGS', 'CHL'],
                'NAME_ES': ['Argentina', 'Islas Malvinas', 'Georgias', 'Chile'],
                'CONTINENT': ['South America'] * 4,
            },
            geometry=[box(-70, -55, -55, -22), box(-61, -53, -57, -51),
                      box(-38, -55, -26, -54), box(-75, -56, -70, -17)],
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

        from ..geodatos import encuadre

        self.assertEqual(encuadre(box(-70, -55, -55, -22)), [-70, -55, -55, -22])

    def test_suma_las_partes_cercanas_encadenadas_y_deja_afuera_las_lejanas(self):
        from shapely.geometry import MultiPolygon, box

        from ..geodatos import encuadre

        continente = box(-70, -52, -55, -22)
        tierra_del_fuego = box(-68, -55, -64, -52.5)  # a medio grado del continente
        encadenada = box(-66, -61, -65, -59)  # a 7° del continente pero a 4° de Tierra del Fuego
        isla_lejana = box(-110, -28, -109, -27)  # como la Isla de Pascua para Chile
        recuadro = encuadre(MultiPolygon([continente, tierra_del_fuego, encadenada, isla_lejana]))
        self.assertEqual(recuadro, [-70, -61, -55, -22])

    def test_si_cruza_el_antimeridiano_queda_la_parte_mas_grande(self):
        from shapely.geometry import MultiPolygon, box

        from ..geodatos import encuadre

        # Como Rusia: el continente hasta 180° y Chukotka del otro lado, a -179°.
        rusia = MultiPolygon([box(30, 45, 180, 75), box(-180, 64, -170, 70)])
        self.assertEqual(encuadre(rusia, distancia=500), [30, 45, 180, 75])

    def test_unir_recuadros(self):
        from ..geodatos import unir_recuadros

        self.assertEqual(unir_recuadros([[-70, -40, -66, -32], [-72, -34, -70, -32]]), [-72, -40, -66, -32])
        self.assertIsNone(unir_recuadros([]))


class NormalizarProvinciasTests(SimpleTestCase):
    def test_un_fragmento_sin_nombre_no_queda_como_nan(self):
        import geopandas as gpd
        from shapely.geometry import box

        from ..management.commands.descargar_natural_earth import normalizar_provincias

        provincias = gpd.GeoDataFrame(
            {'iso_3166_2': ['CO-ANT', 'CO-X01~'], 'adm1_code': ['COL-1', 'COL+99?'],
             'name': ['Antioquia', None], 'adm0_a3': ['COL', 'COL']},
            geometry=[box(0, 0, 1, 1), box(2, 2, 3, 3)], crs='EPSG:4326',
        )
        resultado = normalizar_provincias(provincias).set_index('codigo')
        self.assertEqual(resultado.at['COL+99?', 'nombre'], 'Sin nombre')
        self.assertEqual(resultado.at['CO-ANT', 'nombre'], 'Antioquia')


class CargarRegionesBorradoTests(TestCase):
    def borrar_obsoletas(self, nivel, vigentes):
        salida = io.StringIO()
        ComandoCargarRegiones(stdout=salida).borrar_obsoletas(nivel, vigentes)
        return salida.getvalue()

    def test_borra_las_que_ya_no_estan_con_sus_subregiones(self):
        vieja = Region.objects.create(nivel='pais', codigo='FLK', nombre='Vieja')
        Region.objects.create(nivel='provincia', codigo='FLK-1', nombre='Hija', padre=vieja)
        Region.objects.create(nivel='pais', codigo='ARG', nombre='Argentina')
        self.borrar_obsoletas('pais', {'ARG'})
        self.assertEqual(list(Region.objects.values_list('codigo', flat=True)), ['ARG'])

    def test_no_borra_una_region_con_visitas_ni_con_ficha(self):
        con_visita = Region.objects.create(nivel='pais', codigo='AAA', nombre='Con visita')
        Visita.objects.create(region=con_visita)
        con_ficha = Region.objects.create(nivel='pais', codigo='BBB', nombre='Con ficha')
        FichaRegion.objects.create(region=con_ficha, texto='Algo que escribí')
        salida = self.borrar_obsoletas('pais', set())
        self.assertEqual(Region.objects.count(), 2)
        self.assertIn('no se borró', salida)
