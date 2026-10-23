"""
Estadísticas del mapa: superficie recorrida, países por continente y avance por país.

Solo cuentan las visitas realizadas (no los deseos). Para no contar dos veces la misma superficie,
de las regiones visitadas se suman solo las que no están dentro de otra región visitada:
si marcaste Jujuy entera, Tilcara ya está incluida; si marcaste solo Tilcara, cuenta solo Tilcara.
"""
from collections import Counter, defaultdict
from dataclasses import dataclass

from .models import Region, Viaje, Visita

CONTINENTES = {
    'South America': 'Sudamérica',
    'North America': 'Norteamérica',
    'Europe': 'Europa',
    'Asia': 'Asia',
    'Africa': 'África',
    'Oceania': 'Oceanía',
    'Antarctica': 'Antártida',
    'Seven seas (open ocean)': 'Islas oceánicas',
}


@dataclass
class R:
    id: int
    codigo: str
    nombre: str
    nivel: str
    padre_id: int | None
    area: float
    continente: str


def calcular_estadisticas() -> dict:
    regiones = {
        fila[0]: R(*fila[:5], fila[5] or 0, fila[6])
        for fila in Region.objects.values_list('id', 'codigo', 'nombre', 'nivel', 'padre_id', 'area_km2', 'continente')
    }

    def ancestros(region: R):
        while region.padre_id is not None:
            region = regiones[region.padre_id]
            yield region

    def subir_hasta(region: R, nivel: str) -> R | None:
        return next((r for r in [region, *ancestros(region)] if r.nivel == nivel), None)

    visitadas = set(Visita.objects.filter(realizada=True).values_list('region_id', flat=True))
    # Las de más arriba en la jerarquía: ninguna de sus regiones padre está visitada.
    cubiertas = [regiones[i] for i in visitadas if not any(a.id in visitadas for a in ancestros(regiones[i]))]

    paises = [r for r in regiones.values() if r.nivel == Region.Nivel.PAIS]
    paises_visitados = {subir_hasta(regiones[i], Region.Nivel.PAIS).id for i in visitadas}

    km2_por_pais: dict[int, float] = defaultdict(float)
    for region in cubiertas:
        km2_por_pais[subir_hasta(region, Region.Nivel.PAIS).id] += region.area
    provincias_visitadas_por_pais: dict[int, set[int]] = defaultdict(set)
    for i in visitadas:
        provincia = subir_hasta(regiones[i], Region.Nivel.PROVINCIA)
        if provincia:
            provincias_visitadas_por_pais[provincia.padre_id].add(provincia.id)
    provincias_por_pais = Counter(r.padre_id for r in regiones.values() if r.nivel == Region.Nivel.PROVINCIA)

    total_por_continente = Counter(p.continente for p in paises)
    visitados_por_continente = Counter(regiones[i].continente for i in paises_visitados)

    km2_visitados = sum(r.area for r in cubiertas)
    km2_mundo = sum(p.area for p in paises)
    return {
        'km2_visitados': round(km2_visitados),
        'porcentaje_mundo': round(100 * km2_visitados / km2_mundo, 3) if km2_mundo else 0,
        'paises_visitados': len(paises_visitados),
        'paises_total': len(paises),
        'viajes_hechos': Viaje.objects.filter(estado=Viaje.Estado.HECHO).count(),
        'continentes': sorted(
            (
                {'continente': CONTINENTES.get(c, c), 'visitados': visitados_por_continente[c], 'total': total}
                for c, total in total_por_continente.items()
            ),
            key=lambda c: (-c['visitados'], c['continente']),
        ),
        'paises': sorted(
            (
                {
                    'codigo': regiones[i].codigo,
                    'nombre': regiones[i].nombre,
                    'km2_visitados': round(km2_por_pais[i]),
                    'porcentaje': round(100 * km2_por_pais[i] / regiones[i].area, 2) if regiones[i].area else 0,
                    'provincias_visitadas': len(provincias_visitadas_por_pais[i]),
                    'provincias_total': provincias_por_pais[i],
                }
                for i in paises_visitados
            ),
            key=lambda p: -p['km2_visitados'],
        ),
    }
