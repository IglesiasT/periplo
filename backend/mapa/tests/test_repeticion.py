from rest_framework.test import APITestCase

from ..models import Marca, Region, Viaje, Visita


class RepeticionTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.arg = Region.objects.create(nivel='pais', codigo='ARG', nombre='Argentina')
        cls.salta = Region.objects.create(nivel='provincia', codigo='AR-A', nombre='Salta', padre=cls.arg)
        cls.jujuy = Region.objects.create(nivel='provincia', codigo='AR-Y', nombre='Jujuy', padre=cls.arg)
        cls.caba = Region.objects.create(nivel='provincia', codigo='AR-C', nombre='CABA', padre=cls.arg)
        cls.per = Region.objects.create(nivel='pais', codigo='PER', nombre='Perú')
        cls.cusco = Region.objects.create(nivel='provincia', codigo='PE-CUS', nombre='Cusco', padre=cls.per)

    def repeticion(self):
        respuesta = self.client.get('/api/repeticion/')
        self.assertEqual(respuesta.status_code, 200)
        return respuesta.json()

    def test_vacia(self):
        self.assertEqual(self.repeticion(), {'inicio': {'regiones': {}, 'paises': 0, 'provincias': 0}, 'pasos': []})

    def test_los_viajes_van_en_orden_y_cada_uno_pinta_solo_lo_nuevo(self):
        peru = Viaje.objects.create(nombre='Perú', fecha_inicio='2023-01-10', fecha_fin='2023-01-25')
        norte = Viaje.objects.create(nombre='Norte', fecha_inicio='2019-07-01')
        Visita.objects.create(viaje=norte, region=self.salta)
        Visita.objects.create(viaje=peru, region=self.cusco)
        Visita.objects.create(viaje=peru, region=self.salta)  # ya estaba: no es nueva

        pasos = self.repeticion()['pasos']
        self.assertEqual([p['nombre'] for p in pasos], ['Norte', 'Perú'])
        self.assertEqual(pasos[0]['regiones'], {'AR-A': 'visitada', 'ARG': 'visitada'})
        self.assertEqual(pasos[1]['regiones'], {'PE-CUS': 'visitada', 'PER': 'visitada'})
        self.assertEqual((pasos[1]['paises'], pasos[1]['provincias']), (2, 2))
        self.assertEqual((pasos[1]['fecha_inicio'], pasos[1]['fecha_fin']), ('2023-01-10', '2023-01-25'))

    def test_un_viaje_que_solo_repite_lugares_tambien_es_un_paso(self):
        Visita.objects.create(viaje=Viaje.objects.create(nombre='Ida', fecha_inicio='2019-07-01'), region=self.salta)
        Visita.objects.create(viaje=Viaje.objects.create(nombre='Vuelta', fecha_inicio='2020-07-01'), region=self.salta)

        pasos = self.repeticion()['pasos']
        self.assertEqual([p['nombre'] for p in pasos], ['Ida', 'Vuelta'])
        self.assertEqual(pasos[1]['regiones'], {})

    def test_lo_que_no_tiene_fecha_va_al_inicio(self):
        Visita.objects.create(viaje=None, region=self.jujuy)
        Visita.objects.create(viaje=Viaje.objects.create(nombre='Sin fecha'), region=self.cusco)
        Marca.objects.create(region=self.caba, estado=Marca.Estado.HOGAR)

        datos = self.repeticion()
        self.assertEqual(datos['inicio']['regiones'], {
            'AR-Y': 'visitada', 'AR-C': 'hogar', 'ARG': 'visitada', 'PE-CUS': 'visitada', 'PER': 'visitada',
        })
        self.assertEqual(datos['pasos'], [])

    def test_lo_suelto_gana_a_un_viaje_posterior(self):
        Visita.objects.create(viaje=None, region=self.salta)
        Visita.objects.create(viaje=Viaje.objects.create(nombre='Volver', fecha_inicio='2024-01-01'), region=self.salta)

        datos = self.repeticion()
        self.assertIn('AR-A', datos['inicio']['regiones'])
        self.assertEqual(datos['pasos'][0]['regiones'], {})

    def test_los_deseos_no_se_pintan(self):
        viaje = Viaje.objects.create(nombre='Perú', fecha_inicio='2027-01-01', estado=Viaje.Estado.INVESTIGANDO)
        Visita.objects.create(viaje=viaje, region=self.cusco, realizada=False)

        self.assertEqual(self.repeticion(), {'inicio': {'regiones': {}, 'paises': 0, 'provincias': 0}, 'pasos': []})

    def test_las_marcas_le_ganan_a_las_visitas(self):
        viaje = Viaje.objects.create(nombre='Norte', fecha_inicio='2019-07-01')
        Visita.objects.create(viaje=viaje, region=self.salta)
        Visita.objects.create(viaje=viaje, region=self.jujuy, realizada=False)
        Marca.objects.create(region=self.salta, estado=Marca.Estado.NINGUNO)
        Marca.objects.create(region=self.jujuy, estado=Marca.Estado.VISITADA)  # sin visita realizada: al inicio

        datos = self.repeticion()
        self.assertEqual(datos['inicio']['regiones'], {'AR-Y': 'visitada', 'ARG': 'visitada'})
        self.assertEqual(datos['pasos'][0]['regiones'], {})

    def test_una_marca_fui_toma_la_fecha_de_su_primera_visita(self):
        viaje = Viaje.objects.create(nombre='Norte', fecha_inicio='2019-07-01')
        Visita.objects.create(viaje=viaje, region=self.salta)
        Marca.objects.create(region=self.salta, estado=Marca.Estado.VISITADA)

        datos = self.repeticion()
        self.assertEqual(datos['inicio']['regiones'], {})
        self.assertEqual(datos['pasos'][0]['regiones'], {'AR-A': 'visitada', 'ARG': 'visitada'})
