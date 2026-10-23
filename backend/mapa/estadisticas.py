"""
Estadísticas del mapa: países, provincias argentinas, continentes y entidades históricas pisadas.

Solo cuentan las visitas realizadas (no los deseos). Una visita a un departamento cuenta su
provincia y su país: Tilcara suma Jujuy y Argentina.
"""
from collections import Counter, defaultdict
from dataclasses import dataclass

from .epocas import contar_entidades_pisadas
from .models import Region, Visita

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

# Natural Earth agrupa como "Seven seas" las islas en mar abierto: no es un continente.
OCEANO_ABIERTO = 'Seven seas (open ocean)'
ARGENTINA = 'ARG'


@dataclass
class R:
    id: int
    codigo: str
    nombre: str
    nivel: str
    padre_id: int | None
    continente: str


def calcular_estadisticas() -> dict:
    regiones = {
        fila[0]: R(*fila)
        for fila in Region.objects.values_list('id', 'codigo', 'nombre', 'nivel', 'padre_id', 'continente')
    }

    def subir_hasta(region: R, nivel: str) -> R | None:
        while region is not None and region.nivel != nivel:
            region = regiones.get(region.padre_id)
        return region

    visitadas = [regiones[i] for i in set(Visita.objects.filter(realizada=True).values_list('region_id', flat=True))]
    paises = [r for r in regiones.values() if r.nivel == Region.Nivel.PAIS]
    paises_visitados = {p.id for r in visitadas if (p := subir_hasta(r, Region.Nivel.PAIS))}

    provincias_visitadas_por_pais: dict[int, set[int]] = defaultdict(set)
    for region in visitadas:
        if provincia := subir_hasta(region, Region.Nivel.PROVINCIA):
            provincias_visitadas_por_pais[provincia.padre_id].add(provincia.id)
    provincias_por_pais = Counter(r.padre_id for r in regiones.values() if r.nivel == Region.Nivel.PROVINCIA)

    total_por_continente = Counter(p.continente for p in paises)
    visitados_por_continente = Counter(regiones[i].continente for i in paises_visitados)
    argentina = next((p for p in paises if p.codigo == ARGENTINA), None)

    return {
        'paises_visitados': len(paises_visitados),
        'paises_total': len(paises),
        'provincias_argentinas_visitadas': len(provincias_visitadas_por_pais[argentina.id]) if argentina else 0,
        'provincias_argentinas_total': provincias_por_pais[argentina.id] if argentina else 0,
        'continentes_visitados': sum(1 for c in visitados_por_continente if c != OCEANO_ABIERTO),
        'continentes_total': sum(1 for c in CONTINENTES if c != OCEANO_ABIERTO),
        'entidades_historicas_pisadas': contar_entidades_pisadas(),
        'continentes': sorted(
            (
                {'continente': CONTINENTES.get(c, c), 'visitados': visitados_por_continente[c], 'total': total}
                for c, total in total_por_continente.items()
            ),
            key=lambda c: (-c['visitados'], c['continente']),
        ),
        # De los que más provincias tienen recorridas (en proporción) a los que menos.
        'paises': sorted(
            (
                {
                    'codigo': regiones[i].codigo,
                    'nombre': regiones[i].nombre,
                    'provincias_visitadas': len(provincias_visitadas_por_pais[i]),
                    'provincias_total': provincias_por_pais[i],
                }
                for i in paises_visitados
            ),
            key=lambda p: (-p['provincias_visitadas'] / (p['provincias_total'] or 1), p['nombre']),
        ),
    }
