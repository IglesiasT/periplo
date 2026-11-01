"""El mapa en un año histórico: a qué entidad pertenecía cada región y qué entidades pisé."""
import json
from collections import defaultdict
from pathlib import Path

from django.conf import settings

from .models import EntidadEpoca, EntidadPoliticaHistorica, RegionEpoca, Visita

# Nombres en castellano escritos a mano, por nombre original de historical-basemaps. Es la fuente
# de verdad: sobrevive a regenerar la base y pisa lo que se haya cambiado desde el admin.
NOMBRES_ES = Path(settings.BASE_DIR) / 'data' / 'entidades_es.json'

# Las fronteras de historical-basemaps son aproximadas: una provincia que roza otra entidad en un
# 2% no cuenta como haberla pisado. Sí cuenta la entidad principal de la región, cubra lo que cubra.
UMBRAL_PISADA = 10

# Entidades que ocupaban una región en un año, con su peso (porcentaje de superficie).
Ocupacion = list[tuple[str, float]]


def peso(porcentaje: float | None) -> float:
    # Porcentaje vacío = asignada por cercanía: es la única entidad de esa región.
    return 100 if porcentaje is None else porcentaje


def principal(ocupacion: Ocupacion) -> str:
    return max(ocupacion, key=lambda e: e[1])[0]


def pisables(ocupacion: Ocupacion) -> list[str]:
    """Las entidades que cuenta como pisadas visitar la región: la principal y las que cubren al menos UMBRAL_PISADA."""
    mayor = principal(ocupacion)
    return [entidad for entidad, p in ocupacion if p >= UMBRAL_PISADA or entidad == mayor]


def aplicar_nombres_es(ruta: Path = NOMBRES_ES) -> int:
    """Copia los nombres del JSON a `nombre_es`; las entidades que no están ahí quedan sin traducir.
    Devuelve cuántas quedaron traducidas."""
    traducciones: dict[str, str] = json.loads(ruta.read_text(encoding='utf-8'))
    EntidadPoliticaHistorica.objects.exclude(nombre__in=traducciones).exclude(nombre_es='').update(nombre_es='')
    entidades = list(EntidadPoliticaHistorica.objects.filter(nombre__in=traducciones))
    for entidad in entidades:
        entidad.nombre_es = traducciones[entidad.nombre]
    EntidadPoliticaHistorica.objects.bulk_update(entidades, ['nombre_es'])
    return len(entidades)


def linea_historica(region) -> list[dict]:
    """A qué entidad perteneció la región en cada snapshot, juntando los consecutivos de la misma:
    [{desde, hasta, entidad, nombre}]. `desde` y `hasta` son años de snapshot: entre uno y otro no hay datos."""
    filas = (RegionEpoca.objects.filter(region=region)
             .values_list('anio', 'entidad__nombre', 'entidad__nombre_es', 'porcentaje_superficie'))
    ocupacion: dict[int, Ocupacion] = defaultdict(list)
    nombres: dict[str, str] = {}
    for anio, entidad, nombre_es, porcentaje in filas:
        ocupacion[anio].append((entidad, peso(porcentaje)))
        nombres[entidad] = nombre_es or entidad

    # Un snapshot en el que la región no tiene entidad corta el tramo.
    tramos: list[dict] = []
    continua = False
    for anio in anios_disponibles():
        if anio not in ocupacion:
            continua = False
            continue
        entidad = principal(ocupacion[anio])
        if continua and tramos[-1]['entidad'] == entidad:
            tramos[-1]['hasta'] = anio
        else:
            tramos.append({'desde': anio, 'hasta': anio, 'entidad': entidad, 'nombre': nombres[entidad]})
        continua = True
    return tramos


def contar_entidades_pisadas() -> int:
    """Entidades distintas que pisé en algún año, con la misma regla que el panel de la época."""
    visitadas = Visita.objects.filter(realizada=True).values('region_id')
    filas = (RegionEpoca.objects.filter(region_id__in=visitadas)
             .values_list('anio', 'region_id', 'entidad__nombre', 'porcentaje_superficie'))
    ocupacion: dict[tuple[int, int], Ocupacion] = defaultdict(list)
    for anio, region, entidad, porcentaje in filas:
        ocupacion[(anio, region)].append((entidad, peso(porcentaje)))
    return len({entidad for o in ocupacion.values() for entidad in pisables(o)})


def anios_disponibles() -> list[int]:
    return list(RegionEpoca.objects.order_by('anio').values_list('anio', flat=True).distinct())


def calcular_epoca(anio: int) -> dict:
    """
    {
        anio,
        regiones: {codigo: entidad principal},
        colores: {entidad: color} solo las que tienen color propio,
        nombres: {entidad: nombre en castellano} solo las traducidas,
        pisadas: [{entidad, regiones: [{codigo, nombre}]}] de la que más regiones tiene a la que menos,
        rotulos: [{entidad, lon, lat, area_km2}] dónde va el nombre de cada entidad, de la más grande a la más chica,
        tonos: {entidad: tono} qué aguada del tema le toca: distinta de la de sus vecinas,
    }
    `entidad` es siempre el nombre original, que identifica a la entidad en todos los años.
    """
    filas = (RegionEpoca.objects.filter(anio=anio)
             .values_list('region__codigo', 'entidad__nombre', 'entidad__nombre_es', 'entidad__color',
                          'porcentaje_superficie'))

    ocupacion: dict[str, Ocupacion] = defaultdict(list)
    colores: dict[str, str] = {}
    nombres: dict[str, str] = {}
    for codigo, entidad, nombre_es, color, porcentaje in filas:
        ocupacion[codigo].append((entidad, peso(porcentaje)))
        if nombre_es:
            nombres[entidad] = nombre_es
        if color:
            colores[entidad] = color

    # También las entidades que no ocupan ninguna región: igual llevan su nombre en el mapa.
    rotulos, tonos = [], {}
    for entidad, nombre_es, lon, lat, area, tono in (
            EntidadEpoca.objects.filter(anio=anio).order_by('-area_km2')
            .values_list('entidad__nombre', 'entidad__nombre_es', 'lon', 'lat', 'area_km2', 'tono')):
        rotulos.append({'entidad': entidad, 'lon': lon, 'lat': lat, 'area_km2': area})
        tonos[entidad] = tono
        if nombre_es:
            nombres[entidad] = nombre_es

    pisadas: dict[str, dict[str, str]] = {}
    visitadas = (Visita.objects.filter(realizada=True)
                 .values_list('region__codigo', 'region__nombre').distinct())
    for codigo, nombre in visitadas:
        if codigo in ocupacion:
            for entidad in pisables(ocupacion[codigo]):
                pisadas.setdefault(entidad, {})[codigo] = nombre

    return {
        'anio': anio,
        'regiones': {codigo: principal(o) for codigo, o in ocupacion.items()},
        'colores': colores,
        'nombres': nombres,
        'pisadas': [
            {'entidad': entidad,
             'regiones': [{'codigo': c, 'nombre': n} for c, n in sorted(regiones.items(), key=lambda r: r[1])]}
            for entidad, regiones in sorted(pisadas.items(), key=lambda p: (-len(p[1]), p[0]))
        ],
        'rotulos': rotulos,
        'tonos': tonos,
    }
