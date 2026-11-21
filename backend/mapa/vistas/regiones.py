from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from ..epocas import linea_historica
from ..estados import calcular_estados
from ..geodatos import unir_recuadros
from ..models import FichaRegion, Marca, Region
from .fichas import datos_ficha


@api_view(['GET'])
def estados(request):
    """{codigo: estado} con estado en visitada | hogar | deseo, con las marcas aplicadas. Las regiones sin estado
    no aparecen."""
    return Response(calcular_estados())


@api_view(['GET'])
def region(request, codigo):
    """Todo lo de una región para su ficha: el texto, las visitas a ella o a algo adentro y su línea histórica."""
    region = get_object_or_404(Region.objects.select_related('padre__padre'), codigo=codigo)
    visitas = (region.visitas_incluidas()
               .select_related('viaje', 'region')
               .order_by('-viaje__fecha_inicio', 'region__nombre'))
    _, *ancestros = region.hacia_arriba()
    return Response({
        'codigo': region.codigo,
        'nombre': region.nombre,
        'nivel': region.nivel,
        'ancestros': [{'codigo': a.codigo, 'nombre': a.nombre} for a in ancestros],
        'ficha': datos_ficha(FichaRegion.objects.filter(region=region).first()),
        'marca': datos_marca(Marca.objects.filter(region=region).first()),
        'visitas': [
            {'id': v.id, 'viaje': v.viaje_id, 'viaje_nombre': v.viaje.nombre if v.viaje else None,
             'viaje_inicio': v.viaje.fecha_inicio if v.viaje else None,
             'viaje_fin': v.viaje.fecha_fin if v.viaje else None,
             'region': v.region.codigo, 'region_nombre': v.region.nombre,
             'realizada': v.realizada, 'desde_notion': v.desde_notion}
            for v in visitas
        ],
        'historia': linea_historica(region),
    })


def datos_marca(marca: Marca | None) -> dict | None:
    return None if marca is None else {'estado': marca.estado, 'actualizada': marca.actualizada}


@api_view(['GET'])
def marcas(request):
    """Las regiones marcadas a mano, por nombre: lo que corregí y donde viví."""
    return Response([
        {'codigo': m.region.codigo, 'nombre': m.region.nombre, 'nivel': m.region.nivel, 'estado': m.estado}
        for m in Marca.objects.select_related('region').order_by('region__nombre')
    ])


@api_view(['PUT', 'DELETE'])
def marca(request, codigo):
    """PUT {estado} guarda la marca de la región y la devuelve; DELETE la saca (204). Las visitas no se tocan:
    la marca solo cambia lo que se pinta (ver estados.py)."""
    region = get_object_or_404(Region, codigo=codigo)
    if request.method == 'DELETE':
        Marca.objects.filter(region=region).delete()
        return Response(status=204)
    estado = request.data.get('estado')
    if estado not in Marca.Estado.values:
        raise ValidationError({'estado': [f'Tiene que ser uno de: {", ".join(Marca.Estado.values)}.']})
    marca, _ = Marca.objects.update_or_create(region=region, defaults={'estado': estado})
    return Response(datos_marca(marca))


@api_view(['POST'])
def encuadre(request):
    """{limites: [oeste, sur, este, norte]} que contiene a todas las regiones de {codigos: [...]}.
    Las que no existen se ignoran; si no queda ninguna, `limites` es null. Es POST y no GET porque un logro como el
    Imperio romano pide más de mil provincias, y en la URL no entran."""
    codigos = request.data.get('codigos', [])
    if not isinstance(codigos, list):
        raise ValidationError({'codigos': 'Tiene que ser una lista de códigos.'})
    recuadros = (Region.objects.filter(codigo__in=codigos, encuadre__isnull=False)
                 .values_list('encuadre', flat=True))
    return Response({'limites': unir_recuadros(recuadros)})
