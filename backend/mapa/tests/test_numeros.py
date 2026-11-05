import json
from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase, TestCase

from ..estadisticas import calcular_estadisticas
from ..logros import LOGROS, Indice, Logro, calcular_logros, continentes, grupos, provincias_de, regiones
from ..models import EntidadPoliticaHistorica, Region, RegionEpoca, Visita


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
        return {logro['id']: (logro['cumplidos'], logro['total'], logro['completo'])
                for logro in calcular_logros(list(logros))}

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
        jurisdicciones = next(logro for logro in respuesta.json() if logro['id'] == 'jurisdicciones')
        self.assertEqual(jurisdicciones['total'], 3)


class _TodosLosCodigos(dict):
    """Un índice que dice tener cualquier código: para ver qué pide cada logro antes de que se filtre."""

    def __contains__(self, codigo):
        return True

    def __getitem__(self, codigo):
        return codigo


class CodigosDeLogrosTests(SimpleTestCase):
    def test_todos_los_codigos_existen_en_el_mapa(self):
        # calcular_logros ignora los códigos que no están en la base: uno mal escrito borraría un objetivo sin avisar.
        geo = Path(settings.BASE_DIR).parent / 'frontend' / 'public' / 'geo'
        existentes = set()
        for capa in ('paises', 'provincias', 'departamentos'):
            contenido = json.loads((geo / f'{capa}.geojson').read_text(encoding='utf-8'))
            existentes |= {f['properties']['codigo'] for f in contenido['features']}

        indice = Indice(_TodosLosCodigos(), {}, {})
        pedidos = {c for logro in LOGROS for objetivo in logro.objetivos(indice) for c in objetivo.regiones}
        self.assertTrue(pedidos)
        self.assertEqual(sorted(pedidos - existentes), [])
