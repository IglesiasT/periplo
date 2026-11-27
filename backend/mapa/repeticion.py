"""
La repetición de mi mapa: cómo se fue pintando, viaje por viaje, como la repetición de una partida.

Se arranca con lo que no tiene fecha (los hogares, las visitas sueltas y las de viajes sin fecha de inicio) y después
cada viaje, en orden de `fecha_inicio`, suma lo que pinta por primera vez. Solo cuenta lo visitado: los deseos no
tienen cuándo. Las marcas se aplican como en el mapa (ver estados.py): una región marcada "no fui" o deseo no se
pinta por sí misma, y una marcada "fui" se pinta con su primera visita realizada, o al inicio si no tiene ninguna.
"""
from datetime import date

from .arbol import ArbolRegiones
from .estados import HOGAR, VISITADA
from .models import Marca, Region, Viaje, Visita

# Cuándo se pinta algo: (fecha de inicio del viaje, id del viaje). Lo que no tiene fecha va antes que todo.
type Momento = tuple[date, int]
INICIO: Momento = (date.min, 0)


def _momentos_propios() -> dict[int, tuple[Momento, str]]:
    """{region_id: (momento, estado)} de cada región que se pinta por sí misma, antes de subir a sus padres."""
    primera: dict[int, Momento] = {}
    for region_id, viaje_id, fecha in (Visita.objects.filter(realizada=True)
                                       .values_list('region_id', 'viaje_id', 'viaje__fecha_inicio')):
        momento = (fecha, viaje_id) if fecha else INICIO
        primera[region_id] = min(momento, primera.get(region_id, momento))

    propios = {region_id: (momento, VISITADA) for region_id, momento in primera.items()}
    for region_id, marca in Marca.objects.values_list('region_id', 'estado'):
        if marca == Marca.Estado.VISITADA:
            propios[region_id] = (primera.get(region_id, INICIO), VISITADA)
        elif marca == Marca.Estado.HOGAR:
            propios[region_id] = (INICIO, HOGAR)
        else:  # deseo o "no fui": la marca le gana a sus visitas
            propios.pop(region_id, None)
    return propios


def _contar(codigos: set[str], niveles: dict[str, str]) -> dict[str, int]:
    return {
        'paises': sum(niveles[c] == Region.Nivel.PAIS for c in codigos),
        'provincias': sum(niveles[c] == Region.Nivel.PROVINCIA for c in codigos),
    }


def calcular_repeticion() -> dict:
    """{inicio, pasos}. `inicio` es lo que no tiene fecha; cada paso, un viaje con fecha y visitas realizadas, con
    las regiones que pinta por primera vez (ya subidas hasta su país) y lo pintado hasta ahí. Hogar se pinta solo
    en la región marcada: hacia arriba sube como visitada, igual que en el mapa."""
    arbol = ArbolRegiones()
    pintadas: dict[str, tuple[Momento, str]] = {}
    for region_id, (momento, propio) in _momentos_propios().items():
        for i, nodo in enumerate(arbol.hacia_arriba(region_id)):
            estado = VISITADA if propio == HOGAR and i > 0 else propio
            cuando = momento
            if nodo.codigo in pintadas:
                # La primera vez que se pintó, y hogar si lo es en algún momento (hogar siempre es INICIO).
                cuando_antes, estado_antes = pintadas[nodo.codigo]
                cuando = min(cuando, cuando_antes)
                estado = HOGAR if HOGAR in (estado, estado_antes) else VISITADA
            pintadas[nodo.codigo] = (cuando, estado)

    por_momento: dict[Momento, dict[str, str]] = {}
    for codigo, (momento, estado) in pintadas.items():
        por_momento.setdefault(momento, {})[codigo] = estado

    niveles = {nodo.codigo: nodo.nivel for nodo in arbol.nodos.values()}
    acumuladas: set[str] = set()

    def paso(momento: Momento) -> dict:
        regiones = por_momento.get(momento, {})
        acumuladas.update(regiones)
        return {'regiones': regiones, **_contar(acumuladas, niveles)}

    inicio = paso(INICIO)
    # Un viaje que solo repite lugares también es un paso: es parte del recorrido aunque no pinte nada nuevo.
    viajes = (Viaje.objects.filter(fecha_inicio__isnull=False, visitas__realizada=True)
              .distinct().order_by('fecha_inicio', 'id'))
    pasos = [
        {'viaje': v.id, 'nombre': v.nombre, 'fecha_inicio': v.fecha_inicio, 'fecha_fin': v.fecha_fin,
         **paso((v.fecha_inicio, v.id))}
        for v in viajes
    ]
    return {'inicio': inicio, 'pasos': pasos}
