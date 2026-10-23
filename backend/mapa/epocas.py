"""El mapa en un año histórico: a qué entidad pertenecía cada región y qué entidades pisé."""
import json
from pathlib import Path

from django.conf import settings

from .models import EntidadPoliticaHistorica, RegionEpoca, Visita

# Nombres en castellano escritos a mano, por nombre original de historical-basemaps. Es la fuente
# de verdad: sobrevive a regenerar la base y pisa lo que se haya cambiado desde el admin.
NOMBRES_ES = Path(settings.BASE_DIR) / 'data' / 'entidades_es.json'

# Las fronteras de historical-basemaps son aproximadas: una provincia que roza otra entidad en un
# 2% no cuenta como haberla pisado. Sí cuenta la entidad principal de la región, cubra lo que cubra.
UMBRAL_PISADA = 10


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
    }
    `entidad` es siempre el nombre original, que identifica a la entidad en todos los años.
    """
    filas = (RegionEpoca.objects.filter(anio=anio)
             .values_list('region__codigo', 'entidad__nombre', 'entidad__nombre_es', 'entidad__color',
                          'porcentaje_superficie'))

    principal: dict[str, tuple[str, float]] = {}
    entidades_de: dict[str, list[tuple[str, float | None]]] = {}
    colores: dict[str, str] = {}
    nombres: dict[str, str] = {}
    for codigo, entidad, nombre_es, color, porcentaje in filas:
        if nombre_es:
            nombres[entidad] = nombre_es
        # Porcentaje vacío = asignada por cercanía: es la única entidad de esa región.
        peso = 100 if porcentaje is None else porcentaje
        if codigo not in principal or peso > principal[codigo][1]:
            principal[codigo] = (entidad, peso)
        entidades_de.setdefault(codigo, []).append((entidad, peso))
        if color:
            colores[entidad] = color

    pisadas: dict[str, dict[str, str]] = {}
    visitadas = (Visita.objects.filter(realizada=True)
                 .values_list('region__codigo', 'region__nombre').distinct())
    for codigo, nombre in visitadas:
        for entidad, peso in entidades_de.get(codigo, []):
            if peso >= UMBRAL_PISADA or entidad == principal[codigo][0]:
                pisadas.setdefault(entidad, {})[codigo] = nombre

    return {
        'anio': anio,
        'regiones': {codigo: entidad for codigo, (entidad, _) in principal.items()},
        'colores': colores,
        'nombres': nombres,
        'pisadas': [
            {'entidad': entidad,
             'regiones': [{'codigo': c, 'nombre': n} for c, n in sorted(regiones.items(), key=lambda r: r[1])]}
            for entidad, regiones in sorted(pisadas.items(), key=lambda p: (-len(p[1]), p[0]))
        ],
    }
