import logging
from pathlib import Path

from django.core.files.base import ContentFile
from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response

from ..fotos import ErrorFoto, leer_foto
from ..models import Foto, Region, Viaje, Visita
from ..serializers import AVISO_NOTION, FotoSerializer, ViajeSerializer, VisitaSerializer
from ..ubicacion import SinDatosGeograficos, ubicador_compartido


def id_de_viaje(valor: str) -> int:
    """El id de un viaje que llega como texto: si no es un número, es un 400 y no un 500."""
    try:
        return int(valor)
    except ValueError as e:
        raise ValidationError({'viaje': ['Tiene que ser un número.']}) from e


logger = logging.getLogger(__name__)


class ViajeViewSet(viewsets.ModelViewSet):
    """CRUD de viajes. Los de Notion no se borran (el sync los volvería a crear)."""

    serializer_class = ViajeSerializer
    queryset = Viaje.objects.prefetch_related('visitas__region__padre__padre')

    def perform_destroy(self, viaje):
        if viaje.notion_id:
            raise PermissionDenied(AVISO_NOTION)
        viaje.delete()


class VisitaViewSet(viewsets.ModelViewSet):
    """CRUD de visitas. Filtros: ?viaje=<id> o ?viaje=ninguno (visitas sin viaje).
    Las que creó el sync de Notion son de solo lectura."""

    serializer_class = VisitaSerializer

    def get_queryset(self):
        visitas = Visita.objects.select_related('region__padre__padre')
        viaje = self.request.query_params.get('viaje')
        if viaje == 'ninguno':
            return visitas.filter(viaje__isnull=True)
        if viaje:
            return visitas.filter(viaje_id=id_de_viaje(viaje))
        return visitas

    def perform_update(self, serializer):
        self._proteger_notion(serializer.instance)
        serializer.save()

    def perform_destroy(self, visita):
        self._proteger_notion(visita)
        visita.delete()

    def _proteger_notion(self, visita):
        if visita.desde_notion:
            raise PermissionDenied(AVISO_NOTION)


class FotoViewSet(viewsets.ModelViewSet):
    """Fotos (filtro ?viaje=<id>). Subida: POST multipart con `archivo` y opcionalmente `viaje`, una por pedido."""

    serializer_class = FotoSerializer
    parser_classes = [MultiPartParser, JSONParser]

    def get_queryset(self):
        fotos = Foto.objects.select_related('region__padre__padre', 'viaje')
        viaje = self.request.query_params.get('viaje')
        return fotos.filter(viaje_id=id_de_viaje(viaje)) if viaje else fotos

    def create(self, request):
        archivo = request.FILES.get('archivo')
        if archivo is None:
            raise ValidationError({'archivo': ['Falta el archivo.']})
        viaje = None
        if request.data.get('viaje'):
            viaje = Viaje.objects.filter(id=id_de_viaje(request.data['viaje'])).first()
            if viaje is None:
                raise ValidationError({'viaje': ['No existe.']})
        try:
            datos = leer_foto(archivo.read())
        except ErrorFoto as e:
            raise ValidationError({'archivo': [str(e)]}) from e
        archivo.seek(0)

        foto = Foto(viaje=viaje, archivo=archivo, lat=datos.lat, lon=datos.lon, tomada_en=datos.tomada_en)
        if datos.lat is not None:
            try:
                ubicacion = ubicador_compartido().por_coordenadas(datos.lat, datos.lon, detallar=True)
                foto.region = Region.objects.filter(codigo=ubicacion.codigo).first() if ubicacion else None
            except SinDatosGeograficos:
                # La foto igual aparece en el mapa, por sus coordenadas: solo queda sin región.
                logger.warning('Foto sin región: faltan los datos de data/raw/.')
        foto.miniatura.save(f'{Path(archivo.name).stem}.jpg', ContentFile(datos.miniatura), save=False)
        foto.save()
        return Response(FotoSerializer(foto).data, status=status.HTTP_201_CREATED)
    # Al borrar, los archivos del disco los elimina la señal post_delete (signals.py).
