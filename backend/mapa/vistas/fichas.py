from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import FichaRegion, Region


def datos_ficha(ficha: FichaRegion | None) -> dict | None:
    return None if ficha is None else {'texto': ficha.texto, 'actualizada': ficha.actualizada}


@api_view(['PUT'])
def ficha(request, codigo):
    """Guarda el texto de la ficha ({texto}) y la devuelve. Un texto vacío la borra (204)."""
    region = get_object_or_404(Region, codigo=codigo)
    texto = request.data.get('texto')
    if not isinstance(texto, str):
        return Response({'texto': ['Tiene que ser un texto.']}, status=400)
    if not texto.strip():
        FichaRegion.objects.filter(region=region).delete()
        return Response(status=204)
    ficha, _ = FichaRegion.objects.update_or_create(region=region, defaults={'texto': texto})
    return Response(datos_ficha(ficha))


@api_view(['GET'])
def fichas(request):
    """Las regiones con ficha escrita, de la última editada a la primera."""
    return Response([
        {'codigo': f.region.codigo, 'nombre': f.region.nombre, 'actualizada': f.actualizada}
        for f in FichaRegion.objects.select_related('region')
    ])
