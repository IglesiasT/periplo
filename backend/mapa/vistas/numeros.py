from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..estadisticas import calcular_estadisticas
from ..logros import calcular_logros
from ..repeticion import calcular_repeticion


@api_view(['GET'])
def estadisticas(request):
    """Países, provincias argentinas, continentes y entidades pisadas (ver mapa/estadisticas.py)."""
    return Response(calcular_estadisticas())


@api_view(['GET'])
def logros(request):
    """Cada logro con su avance y sus objetivos (ver mapa/logros.py)."""
    return Response(calcular_logros())


@api_view(['GET'])
def repeticion(request):
    """Cómo se fue pintando el mapa, viaje por viaje (ver mapa/repeticion.py)."""
    return Response(calcular_repeticion())
