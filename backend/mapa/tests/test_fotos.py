import io
import shutil
import tempfile
from pathlib import Path
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APITestCase

from ..fotos import ErrorFoto, leer_foto
from ..models import Foto, Region, Viaje, Visita
from ..ubicacion import Ubicacion


def jpeg_con_gps(lat_ref='S', lat=(23, 34, 39.6), lon_ref='W', lon=(65, 23, 46.8), fecha='2025:01:10 14:30:00'):
    """JPEG chico generado en memoria con GPS y fecha en el EXIF."""
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
        with mock.patch('mapa.vistas.viajes.ubicador_compartido') as ubicador:
            ubicador.return_value.por_coordenadas.return_value = Ubicacion('AR-38094', 'place')
            return self.client.post('/api/fotos/', {'viaje': self.viaje.id, 'archivo': archivo}, format='multipart')

    def test_subir_ubica_la_foto_y_sugiere_la_region(self):
        respuesta = self.subir()
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data['region'], 'AR-38094')
        self.assertFalse(respuesta.data['region_en_viaje'])
        self.assertTrue(respuesta.data['miniatura'].startswith('/media/fotos/miniaturas/'))

    def test_si_el_viaje_tiene_la_provincia_no_sugiere_el_departamento(self):
        Visita.objects.create(viaje=self.viaje, region=self.jujuy)
        self.assertTrue(self.subir().data['region_en_viaje'])

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

    def test_un_viaje_que_no_es_un_numero_es_un_400(self):
        self.assertEqual(self.client.get('/api/fotos/?viaje=abc').status_code, 400)
        archivo = SimpleUploadedFile('tilcara.jpg', jpeg_con_gps(), content_type='image/jpeg')
        respuesta = self.client.post('/api/fotos/', {'viaje': 'abc', 'archivo': archivo}, format='multipart')
        self.assertEqual(respuesta.status_code, 400)

    def test_una_foto_cortada_es_un_400(self):
        archivo = SimpleUploadedFile('cortada.jpg', jpeg_con_gps()[:-100], content_type='image/jpeg')
        respuesta = self.client.post('/api/fotos/', {'archivo': archivo}, format='multipart')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('dañado', respuesta.data['archivo'][0])

    def test_archivo_invalido(self):
        archivo = SimpleUploadedFile('foto.heic', b'no soy una imagen', content_type='image/heic')
        respuesta = self.client.post('/api/fotos/', {'archivo': archivo}, format='multipart')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('HEIC', respuesta.data['archivo'][0])
