from rest_framework.decorators import api_view
from rest_framework.response import Response

from .epocas import anios_disponibles, calcular_epoca
from .estadisticas import calcular_estadisticas
from .logros import calcular_logros
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


@api_view(['GET'])
def estadisticas(request):
    """Superficie recorrida, países por continente y avance por país (ver mapa/estadisticas.py)."""
    return Response(calcular_estadisticas())


@api_view(['GET'])
def logros(request):
    """Cada logro con su avance y sus objetivos (ver mapa/logros.py)."""
    return Response(calcular_logros())


@api_view(['GET'])
def historia(request):
    """Años con snapshot histórico cruzado, de menor a mayor (los a. C. en negativo)."""
    return Response(anios_disponibles())


@api_view(['GET'])
def epoca(request, anio):
    """Entidad de cada región en ese año y entidades pisadas (ver mapa/epocas.py)."""
    anio = int(anio)
    if anio not in anios_disponibles():
        return Response({'detail': f'No hay datos históricos para el año {anio}.'}, status=404)
    return Response(calcular_epoca(anio))
