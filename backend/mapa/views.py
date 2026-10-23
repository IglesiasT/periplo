from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .epocas import anios_disponibles, calcular_epoca, linea_historica
from .estadisticas import calcular_estadisticas
from .logros import calcular_logros
from .models import FichaRegion, Region, Visita

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


def datos_ficha(ficha: FichaRegion | None) -> dict | None:
    return None if ficha is None else {'texto': ficha.texto, 'actualizada': ficha.actualizada}


@api_view(['GET'])
def region(request, codigo):
    """Todo lo de una región para su ficha: el texto, las visitas a ella o a algo adentro y su línea histórica."""
    region = get_object_or_404(Region.objects.select_related('padre__padre'), codigo=codigo)
    visitas = (Visita.objects
               .filter(Q(region=region) | Q(region__padre=region) | Q(region__padre__padre=region))
               .select_related('viaje', 'region')
               .order_by('-viaje__fecha_inicio', 'region__nombre'))
    ancestros, padre = [], region.padre
    while padre is not None:
        ancestros.append({'codigo': padre.codigo, 'nombre': padre.nombre})
        padre = padre.padre
    return Response({
        'codigo': region.codigo,
        'nombre': region.nombre,
        'nivel': region.nivel,
        'ancestros': ancestros,
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
