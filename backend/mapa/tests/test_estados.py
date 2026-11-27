from django.test import TestCase

from ..estados import calcular_estados, ids_regiones_visitadas, pisa
from ..models import Marca, Region, Viaje, Visita


class CalcularEstadosTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.arg = Region.objects.create(nivel='pais', codigo='ARG', nombre='Argentina')
        cls.salta = Region.objects.create(nivel='provincia', codigo='AR-A', nombre='Salta', padre=cls.arg)
        cls.tucuman = Region.objects.create(nivel='provincia', codigo='AR-T', nombre='Tucumán', padre=cls.arg)
        cls.per = Region.objects.create(nivel='pais', codigo='PER', nombre='Perú')
        cls.cusco = Region.objects.create(nivel='provincia', codigo='PE-CUS', nombre='Cusco', padre=cls.per)

    def test_el_estado_sube_al_pais(self):
        viaje = Viaje.objects.create(nombre='NOA')
        Visita.objects.create(viaje=viaje, region=self.tucuman)
        Visita.objects.create(viaje=viaje, region=self.salta)

        self.assertEqual(calcular_estados(), {'AR-T': 'visitada', 'AR-A': 'visitada', 'ARG': 'visitada'})

    def test_visita_no_realizada_es_deseo(self):
        viaje = Viaje.objects.create(nombre='Perú', estado=Viaje.Estado.INVESTIGANDO)
        Visita.objects.create(viaje=viaje, region=self.cusco, realizada=False)

        self.assertEqual(calcular_estados(), {'PE-CUS': 'deseo', 'PER': 'deseo'})

    def test_lo_visitado_le_gana_al_deseo(self):
        Visita.objects.create(viaje=Viaje.objects.create(nombre='Volver'), region=self.salta, realizada=False)
        Visita.objects.create(viaje=None, region=self.salta)

        self.assertEqual(calcular_estados()['AR-A'], 'visitada')

    def test_un_deseo_no_le_gana_a_lo_visitado_aunque_venga_despues(self):
        Visita.objects.create(viaje=None, region=self.salta)
        Visita.objects.create(viaje=Viaje.objects.create(nombre='Volver'), region=self.salta, realizada=False)

        self.assertEqual(calcular_estados()['AR-A'], 'visitada')


class MarcasTests(TestCase):
    """La marca de una región le gana a las visitas a esa región, sin borrarlas."""

    @classmethod
    def setUpTestData(cls):
        cls.arg = Region.objects.create(nivel='pais', codigo='ARG', nombre='Argentina')
        cls.tucuman = Region.objects.create(nivel='provincia', codigo='AR-T', nombre='Tucumán', padre=cls.arg)
        cls.tafi = Region.objects.create(nivel='departamento', codigo='AR-90105', nombre='Tafí del Valle',
                                         padre=cls.tucuman)
        cls.caba = Region.objects.create(nivel='provincia', codigo='AR-C', nombre='CABA', padre=cls.arg)
        cls.comuna = Region.objects.create(nivel='departamento', codigo='AR-02035', nombre='Comuna 5', padre=cls.caba)

    def test_la_marca_le_gana_a_notion_y_no_borra_la_visita(self):
        Visita.objects.create(region=self.tafi, realizada=False, desde_notion=True)
        Marca.objects.create(region=self.tafi, estado=Marca.Estado.VISITADA)
        self.assertEqual(calcular_estados(), {'AR-90105': 'visitada', 'AR-T': 'visitada', 'ARG': 'visitada'})
        self.assertTrue(Visita.objects.filter(region=self.tafi).exists())

    def test_hogar_sube_como_visitada(self):
        Marca.objects.create(region=self.comuna, estado=Marca.Estado.HOGAR)
        self.assertEqual(calcular_estados(), {'AR-02035': 'hogar', 'AR-C': 'visitada', 'ARG': 'visitada'})
        self.assertEqual(ids_regiones_visitadas(), {self.comuna.id})

    def test_no_fui_anula_las_visitas_a_esa_region(self):
        Visita.objects.create(region=self.tucuman)
        Marca.objects.create(region=self.tucuman, estado=Marca.Estado.NINGUNO)
        self.assertEqual(calcular_estados(), {})
        self.assertEqual(ids_regiones_visitadas(), set())

    def test_lo_de_las_hijas_sigue_subiendo(self):
        Visita.objects.create(region=self.tafi)
        Marca.objects.create(region=self.tucuman, estado=Marca.Estado.NINGUNO)
        self.assertEqual(calcular_estados()['AR-T'], 'visitada')

    def test_un_deseo_marcado_no_cuenta_como_visitado(self):
        Visita.objects.create(region=self.tafi)
        Marca.objects.create(region=self.tafi, estado=Marca.Estado.DESEO)
        self.assertEqual(calcular_estados()['AR-90105'], 'deseo')
        self.assertEqual(ids_regiones_visitadas(), set())


class PisaTests(TestCase):
    def test_agregar_no_pisa(self):
        self.assertFalse(pisa('visitada', None))
        self.assertFalse(pisa('visitada', 'deseo'))
        self.assertFalse(pisa('hogar', 'visitada'))
        self.assertFalse(pisa('visitada', 'visitada'))

    def test_bajar_o_anular_pisa(self):
        self.assertTrue(pisa('deseo', 'visitada'))
        self.assertTrue(pisa('ninguno', 'visitada'))
        self.assertTrue(pisa('ninguno', 'deseo'))
