"""Cómo se pinta cada región en el mapa, según las visitas que la tocan."""
from .models import Visita

# Si una región tiene una visita hecha y un deseo, gana la visita.
VISITADA = 'visitada'
DESEO = 'deseo'


def calcular_estados() -> dict[str, str]:
    """Estado de cada región tocada por alguna visita, propagado hacia sus regiones padre."""
    estados: dict[str, str] = {}
    visitas = Visita.objects.select_related('region__padre__padre')
    for visita in visitas:
        estado = VISITADA if visita.realizada else DESEO
        for region in visita.region.hacia_arriba():
            if estados.get(region.codigo) != VISITADA:
                estados[region.codigo] = estado
    return estados
