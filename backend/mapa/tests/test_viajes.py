from rest_framework.test import APITestCase

from ..models import Region, Viaje, Visita


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


class VisitasFiltroTests(APITestCase):
    def test_un_viaje_que_no_es_un_numero_es_un_400(self):
        self.assertEqual(self.client.get('/api/visitas/?viaje=abc').status_code, 400)


class OrigenTests(APITestCase):
    DATOS = {'nombre': 'NOA', 'estado': 'deseo'}

    def test_una_pagina_de_otro_sitio_no_puede_escribir(self):
        respuesta = self.client.post('/api/viajes/', self.DATOS, HTTP_ORIGIN='https://malo.example')
        self.assertEqual(respuesta.status_code, 403)
        self.assertFalse(Viaje.objects.exists())

    def test_tampoco_un_iframe_sin_origen_conocido(self):
        self.assertEqual(self.client.post('/api/viajes/', self.DATOS, HTTP_ORIGIN='null').status_code, 403)

    def test_la_app_si(self):
        for origen in ('http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173'):
            respuesta = self.client.post('/api/viajes/', self.DATOS, HTTP_ORIGIN=origen)
            self.assertEqual(respuesta.status_code, 201, origen)

    def test_un_pedido_sin_origen_pasa(self):
        self.assertEqual(self.client.post('/api/viajes/', self.DATOS).status_code, 201)

    def test_leer_no_se_bloquea(self):
        self.assertEqual(self.client.get('/api/viajes/', HTTP_ORIGIN='https://malo.example').status_code, 200)
