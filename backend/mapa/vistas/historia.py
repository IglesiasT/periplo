from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..epocas import anios_disponibles, calcular_epoca


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
