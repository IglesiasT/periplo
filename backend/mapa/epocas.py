"""El mapa en un año histórico: a qué entidad pertenecía cada región y qué entidades pisé."""
from .models import RegionEpoca, Visita

# Las fronteras de historical-basemaps son aproximadas: una provincia que roza otra entidad en un
# 2% no cuenta como haberla pisado. Sí cuenta la entidad principal de la región, cubra lo que cubra.
UMBRAL_PISADA = 10


def anios_disponibles() -> list[int]:
    return list(RegionEpoca.objects.order_by('anio').values_list('anio', flat=True).distinct())


def calcular_epoca(anio: int) -> dict:
    """
    {
        anio,
        regiones: {codigo: entidad principal},
        colores: {entidad: color} solo las que tienen color propio,
        pisadas: [{entidad, regiones: [{codigo, nombre}]}] de la que más regiones tiene a la que menos,
    }
    """
    filas = (RegionEpoca.objects.filter(anio=anio)
             .values_list('region__codigo', 'entidad__nombre', 'entidad__color', 'porcentaje_superficie'))

    principal: dict[str, tuple[str, float]] = {}
    entidades_de: dict[str, list[tuple[str, float | None]]] = {}
    colores: dict[str, str] = {}
    for codigo, entidad, color, porcentaje in filas:
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
        'pisadas': [
            {'entidad': entidad,
             'regiones': [{'codigo': c, 'nombre': n} for c, n in sorted(regiones.items(), key=lambda r: r[1])]}
            for entidad, regiones in sorted(pisadas.items(), key=lambda p: (-len(p[1]), p[0]))
        ],
    }
