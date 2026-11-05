from django.test import TestCase

from ..estados import calcular_estados
from ..models import Region, Viaje, Visita


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
