from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from .models import Viaje, Visita
from .serializers import AVISO_NOTION, ViajeSerializer, VisitaSerializer


class ViajeViewSet(viewsets.ModelViewSet):
    """CRUD de viajes. Los de Notion no se borran (el sync los volvería a crear)."""

    serializer_class = ViajeSerializer
    queryset = Viaje.objects.prefetch_related('visitas__region')

    def perform_destroy(self, viaje):
        if viaje.notion_id:
            raise PermissionDenied(AVISO_NOTION)
        viaje.delete()


class VisitaViewSet(viewsets.ModelViewSet):
    """CRUD de visitas. Filtros: ?viaje=<id> o ?viaje=ninguno (visitas sin viaje).
    Las que creó el sync de Notion son de solo lectura."""

    serializer_class = VisitaSerializer

    def get_queryset(self):
        visitas = Visita.objects.select_related('region')
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
