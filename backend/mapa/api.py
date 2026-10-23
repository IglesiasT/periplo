from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from .models import Region, Ruta, Viaje, Visita
from .rutas import ErrorRuta, leer_archivo, longitud_km
from .serializers import AVISO_NOTION, RutaSerializer, ViajeSerializer, VisitaSerializer
from .ubicacion import Ubicador


class ViajeViewSet(viewsets.ModelViewSet):
    """CRUD de viajes. Los de Notion no se borran (el sync los volvería a crear)."""

    serializer_class = ViajeSerializer
    queryset = Viaje.objects.prefetch_related('visitas__region__padre__padre', 'rutas')

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
            return visitas.filter(viaje_id=viaje)
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


class RutaViewSet(viewsets.ModelViewSet):
    """CRUD de rutas (filtro ?viaje=<id>), importación de GPX/KML y marcado de regiones atravesadas."""

    serializer_class = RutaSerializer

    def get_queryset(self):
        rutas = Ruta.objects.all()
        viaje = self.request.query_params.get('viaje')
        return rutas.filter(viaje_id=viaje) if viaje else rutas

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    def importar(self, request):
        """POST multipart con `viaje` y `archivo` (.gpx o .kml). Crea una ruta por cada recorrido del archivo."""
        archivo = request.FILES.get('archivo')
        viaje = Viaje.objects.filter(id=request.data.get('viaje')).first()
        if archivo is None or viaje is None:
            raise ValidationError('Hacen falta `viaje` y `archivo`.')
        try:
            leidas = leer_archivo(archivo.read(), archivo.name)
        except ErrorRuta as e:
            raise ValidationError({'archivo': [str(e)]}) from e

        origen = Ruta.Origen.GPX if archivo.name.lower().endswith('.gpx') else Ruta.Origen.KML
        rutas = [
            Ruta.objects.create(viaje=viaje, nombre=r.nombre, coordenadas=r.coordenadas,
                                longitud_km=longitud_km(r.coordenadas), origen=origen)
            for r in leidas
        ]
        return Response(RutaSerializer(rutas, many=True).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def marcar_transito(self, request, pk=None):
        """Agrega como "tránsito" las regiones que atraviesa la ruta y todavía no están en el viaje."""
        ruta = self.get_object()
        codigos = Ubicador(usar_nominatim=False).regiones_atravesadas(ruta.coordenadas)
        ya_estan = set(ruta.viaje.visitas.values_list('region__codigo', flat=True))
        nuevas = [c for c in codigos if c not in ya_estan]
        with transaction.atomic():
            for region in Region.objects.filter(codigo__in=nuevas):
                Visita.objects.create(viaje=ruta.viaje, region=region, tipo_presencia=Visita.TipoPresencia.TRANSITO,
                                      realizada=ruta.viaje.estado == Viaje.Estado.HECHO)
        return Response({'agregadas': nuevas, 'ya_estaban': len(codigos) - len(nuevas)})
