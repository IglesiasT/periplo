"""Cómo se pinta cada región en el mapa, según las visitas que la tocan."""
from .models import Visita

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
        for region in visita.region.hacia_arriba():
            actual = estados.get(region.codigo)
            if actual is None or PRIORIDAD[estado] > PRIORIDAD[actual]:
                estados[region.codigo] = estado
    return estados
