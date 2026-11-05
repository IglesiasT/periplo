from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..epocas import linea_historica
from ..estados import calcular_estados
from ..geodatos import unir_recuadros
from ..models import FichaRegion, Region
from .fichas import datos_ficha


@api_view(['GET'])
def estados(request):
    """{codigo: estado} con estado en estadia | paso | transito | deseo. Las regiones sin estado no aparecen."""
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
        'visitas': [
            {'id': v.id, 'viaje': v.viaje_id, 'viaje_nombre': v.viaje.nombre if v.viaje else None,
             'viaje_inicio': v.viaje.fecha_inicio if v.viaje else None,
             'region': v.region.codigo, 'region_nombre': v.region.nombre,
             'tipo_presencia': v.tipo_presencia, 'realizada': v.realizada}
            for v in visitas
        ],
        'historia': linea_historica(region),
    })


@api_view(['GET'])
def encuadre(request):
    """{limites: [oeste, sur, este, norte]} que contiene a todas las regiones ?codigo=...&codigo=...
    Las que no existen se ignoran; si no queda ninguna, `limites` es null."""
    recuadros = (Region.objects.filter(codigo__in=request.query_params.getlist('codigo'), encuadre__isnull=False)
                 .values_list('encuadre', flat=True))
    return Response({'limites': unir_recuadros(recuadros)})
