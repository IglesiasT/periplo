from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Visita

# De más a menos intenso: si una región tiene varios estados, gana el de mayor prioridad.
DESEO = 'deseo'
PRIORIDAD = {
    Visita.TipoPresencia.ESTADIA: 3,
    Visita.TipoPresencia.PASO: 2,
    Visita.TipoPresencia.TRANSITO: 1,
    DESEO: 0,
}


def calcular_estados() -> dict[str, str]:
    """Estado de cada región tocada por alguna visita, propagado hacia sus regiones padre."""
    estados: dict[str, str] = {}
    visitas = Visita.objects.select_related('region__padre__padre')
    for visita in visitas:
        estado = visita.tipo_presencia if visita.realizada else DESEO
        region = visita.region
        while region is not None:
            actual = estados.get(region.codigo)
            if actual is None or PRIORIDAD[estado] > PRIORIDAD[actual]:
                estados[region.codigo] = estado
            region = region.padre
    return estados


@api_view(['GET'])
def estados(request):
    """{codigo: estado} con estado en estadia | paso | transito | deseo. Las regiones sin estado no aparecen."""
    return Response(calcular_estados())
