"""
Cómo se pinta cada región en el mapa. Hay dos fuentes, que pueden no coincidir:

- las visitas, de los viajes y de Notion;
- las marcas, lo que corrijo a mano en el mapa.

La marca de una región reemplaza a las visitas a esa misma región, sin borrarlas. Lo de sus hijas sigue subiendo
como siempre: si marco Tucumán "no fui" pero Tafí del Valle está visitada, Tucumán se pinta igual.
"""
from .models import Marca, Region, Visita

VISITADA = 'visitada'
HOGAR = 'hogar'
DESEO = 'deseo'

# Si a una región llegan varios estados, gana el de más prioridad.
PRIORIDAD = {DESEO: 0, VISITADA: 1, HOGAR: 2}
# Lo que una marca dice de lo que se pinta. NINGUNO no pinta nada.
ESTADO_DE_MARCA = {Marca.Estado.VISITADA: VISITADA, Marca.Estado.HOGAR: HOGAR, Marca.Estado.DESEO: DESEO}


def estados_propios() -> dict[int, str]:
    """{region_id: estado} de las regiones que tienen visitas o marca, sin propagar todavía."""
    marcas = dict(Marca.objects.values_list('region_id', 'estado'))
    propios: dict[int, str] = {}
    for region_id, realizada in Visita.objects.exclude(region_id__in=marcas).values_list('region_id', 'realizada'):
        estado = VISITADA if realizada else DESEO
        if PRIORIDAD[estado] > PRIORIDAD.get(propios.get(region_id), -1):
            propios[region_id] = estado
    for region_id, marca in marcas.items():
        if marca in ESTADO_DE_MARCA:
            propios[region_id] = ESTADO_DE_MARCA[marca]
    return propios


def calcular_estados() -> dict[str, str]:
    """{codigo: estado} de cada región tocada, propagado hacia sus regiones padre. Hogar es solo de la región
    marcada: hacia arriba sube como visitada (Argentina no es "hogar" por tener una comuna)."""
    propios = estados_propios()
    estados: dict[str, str] = {}
    for region in Region.objects.filter(id__in=propios).select_related('padre__padre'):
        propio = propios[region.id]
        for i, nodo in enumerate(region.hacia_arriba()):
            estado = VISITADA if propio == HOGAR and i > 0 else propio
            if PRIORIDAD[estado] > PRIORIDAD.get(estados.get(nodo.codigo), -1):
                estados[nodo.codigo] = estado
    return estados


def ids_regiones_visitadas() -> set[int]:
    """Las regiones donde estuve, con las marcas aplicadas: lo que cuentan Números, Logros y la historia."""
    return {region_id for region_id, estado in estados_propios().items() if estado in (VISITADA, HOGAR)}


def estado_de_visitas(realizadas: list[bool]) -> str | None:
    """Lo que dicen las visitas a una región, sin marcas: visitada si alguna se hizo."""
    if not realizadas:
        return None
    return VISITADA if any(realizadas) else DESEO


def pisa(marca: str, visitas: str | None) -> bool:
    """¿La marca esconde algo que dicen las visitas? Agregar (visitada sobre deseo, hogar sobre visitada) no pisa;
    bajar a deseo o "no fui" sobre lo visitado, sí. Es la misma regla que usa el modal del frontend (conflictos.ts)."""
    if visitas is None:
        return False
    return PRIORIDAD.get(ESTADO_DE_MARCA.get(marca), -1) < PRIORIDAD[visitas]
