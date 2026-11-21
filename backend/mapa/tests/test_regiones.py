from rest_framework.test import APITestCase

from ..models import EntidadPoliticaHistorica, FichaRegion, Marca, Region, RegionEpoca, Viaje, Visita


class EncuadreApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        Region.objects.create(nivel='provincia', codigo='AR-M', nombre='Mendoza', encuadre=[-70.6, -37.6, -66.5, -32])
        Region.objects.create(nivel='provincia', codigo='CL-RM', nombre='Santiago',
                              encuadre=[-71.7, -34.3, -69.8, -32.9])
        Region.objects.create(nivel='provincia', codigo='AR-X', nombre='Sin calcular')

    def test_une_las_regiones_pedidas_e_ignora_las_desconocidas(self):
        respuesta = self.client.post('/api/encuadre/', {'codigos': ['AR-M', 'CL-RM', 'XX-NADA', 'AR-X']}, format='json')
        self.assertEqual(respuesta.data, {'limites': [-71.7, -37.6, -66.5, -32]})

    def test_sin_regiones_conocidas(self):
        self.assertEqual(self.client.post('/api/encuadre/', {'codigos': ['XX-NADA']}, format='json').data,
                         {'limites': None})

    def test_muchas_regiones(self):
        # Un logro grande pide más de mil: por URL no entraban (431).
        codigos = ['AR-M', 'CL-RM'] + [f'XX-{i}' for i in range(2000)]
        respuesta = self.client.post('/api/encuadre/', {'codigos': codigos}, format='json')
        self.assertEqual(respuesta.data, {'limites': [-71.7, -37.6, -66.5, -32]})
        self.assertEqual(self.client.post('/api/encuadre/', {'codigos': 'AR-M'}, format='json').status_code, 400)


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
        respuesta = self.client.put('/api/regiones/XX-NADA/ficha/', {'texto': 'a'}, format='json')
        self.assertEqual(respuesta.status_code, 404)


class MarcaApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.arg = Region.objects.create(nivel='pais', codigo='ARG', nombre='Argentina')
        cls.tucuman = Region.objects.create(nivel='provincia', codigo='AR-T', nombre='Tucumán', padre=cls.arg)
        Visita.objects.create(region=cls.tucuman, realizada=False, desde_notion=True)

    def test_marcar_cambiar_y_sacar(self):
        respuesta = self.client.put('/api/regiones/AR-T/marca/', {'estado': 'hogar'}, format='json')
        self.assertEqual((respuesta.status_code, respuesta.data['estado']), (200, 'hogar'))
        self.client.put('/api/regiones/AR-T/marca/', {'estado': 'visitada'}, format='json')
        detalle = self.client.get('/api/regiones/AR-T/').data
        self.assertEqual(detalle['marca']['estado'], 'visitada')
        self.assertEqual(self.client.get('/api/estados/').data['AR-T'], 'visitada')
        self.assertEqual(self.client.get('/api/marcas/').data,
                         [{'codigo': 'AR-T', 'nombre': 'Tucumán', 'nivel': 'provincia', 'estado': 'visitada'}])

        self.assertEqual(self.client.delete('/api/regiones/AR-T/marca/').status_code, 204)
        self.assertIsNone(self.client.get('/api/regiones/AR-T/').data['marca'])
        # La visita de Notion siguió ahí todo el tiempo: vuelve a verse.
        self.assertEqual(self.client.get('/api/estados/').data['AR-T'], 'deseo')
        self.assertTrue(self.client.get('/api/regiones/AR-T/').data['visitas'][0]['desde_notion'])

    def test_estado_invalido_y_region_inexistente(self):
        self.assertEqual(self.client.put('/api/regiones/AR-T/marca/', {'estado': 'de_paso'}, format='json')
                         .status_code, 400)
        self.assertEqual(self.client.put('/api/regiones/XX/marca/', {'estado': 'hogar'}, format='json')
                         .status_code, 404)

    def test_la_marca_protege_a_su_region(self):
        from django.db.models import ProtectedError

        Marca.objects.create(region=self.tucuman, estado=Marca.Estado.HOGAR)
        with self.assertRaises(ProtectedError):
            self.tucuman.delete()
