"""
Decide qué visitas surgen de Destinations y Lugares. No toca la base ni la red: recibe un `ubicador`.
"""
from dataclasses import dataclass
from typing import Protocol

from .notion import Destino, Lugar, Place
from .ubicacion import Ubicacion


class UbicadorProtocolo(Protocol):
    def por_coordenadas(self, lat: float, lon: float, detallar: bool = False) -> Ubicacion | None: ...
    def por_nombre(self, nombre: str) -> Ubicacion | None: ...


@dataclass
class VisitaPlanificada:
    viaje_notion_id: str | None     # None = lugar visitado sin viaje
    codigo: str
    realizada: bool
    origen: str                     # para el reporte: qué lugar y cómo se ubicó


def ubicar(ubicador: UbicadorProtocolo, nombre: str, place: Place | None, detallar: bool = False) -> Ubicacion | None:
    """Coordenadas de Notion si las hay; si no, el nombre. `detallar` baja a departamento cuando se puede:
    se usa para Lugares (un sitio concreto), no para Destinos ("Catamarca" es toda la provincia)."""
    if place is not None:
        ubicacion = ubicador.por_coordenadas(place.lat, place.lon, detallar)
        if ubicacion:
            return ubicacion
    return ubicador.por_nombre(nombre)


def planificar_visitas(
    destinos: list[Destino], lugares: list[Lugar], ubicador: UbicadorProtocolo,
) -> tuple[list[VisitaPlanificada], list[str]]:
    """Devuelve (visitas, cosas sin ubicar). Una visita por viaje y región."""
    lugares_por_id = {lugar.notion_id: lugar for lugar in lugares}
    ids_destinos = {destino.notion_id for destino in destinos}
    visitas: list[VisitaPlanificada] = []
    sin_ubicar: list[str] = []

    for destino in destinos:
        hecho = destino.estado == 'hecho'
        de_lugares = []
        # 1. Los Lugares del destino: son lo más preciso y traen su propio Estado (Visitado / Planeado).
        for lugar in filter(None, map(lugares_por_id.get, destino.lugares_ids)):
            ubicacion = ubicar(ubicador, lugar.nombre, lugar.place, detallar=True)
            if ubicacion is None:
                sin_ubicar.append(f'Lugar "{lugar.nombre}" (de {destino.nombre})')
                continue
            realizada = lugar.visitado if lugar.visitado is not None else hecho
            de_lugares.append(VisitaPlanificada(destino.notion_id, ubicacion.codigo, realizada,
                                                f'{lugar.nombre} [{ubicacion.metodo}]'))
        visitas += de_lugares
        if de_lugares:
            continue
        # 2. Sin lugares ubicables: el Place o el nombre del destino. Visitado solo si está Done!.
        ubicacion = ubicar(ubicador, destino.nombre, destino.place)
        if ubicacion is None:
            sin_ubicar.append(destino.nombre)
        else:
            visitas.append(VisitaPlanificada(destino.notion_id, ubicacion.codigo, hecho,
                                             f'{destino.nombre} [{ubicacion.metodo}]'))

    # 3. Lugares que no cuelgan de ningún destino: visitas sin viaje.
    for lugar in lugares:
        if ids_destinos & set(lugar.viajes_ids):
            continue
        ubicacion = ubicar(ubicador, lugar.nombre, lugar.place, detallar=True)
        if ubicacion is None:
            sin_ubicar.append(f'Lugar "{lugar.nombre}"')
            continue
        realizada = lugar.visitado if lugar.visitado is not None else True
        visitas.append(VisitaPlanificada(None, ubicacion.codigo, realizada, f'{lugar.nombre} [{ubicacion.metodo}]'))

    return unificar(visitas), sin_ubicar


def unificar(visitas: list[VisitaPlanificada]) -> list[VisitaPlanificada]:
    """Varios lugares en la misma región y viaje (Tilcara, Humahuaca...) son una sola visita.
    Si alguno fue visitado, la visita queda realizada."""
    por_clave: dict[tuple[str | None, str], VisitaPlanificada] = {}
    for visita in visitas:
        clave = (visita.viaje_notion_id, visita.codigo)
        if clave in por_clave:
            existente = por_clave[clave]
            existente.realizada = existente.realizada or visita.realizada
            existente.origen += f', {visita.origen}'
        else:
            por_clave[clave] = VisitaPlanificada(**vars(visita))
    return list(por_clave.values())
