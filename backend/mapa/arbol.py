"""
Todas las regiones en memoria, para recorrer el árbol sin una consulta por región: las estadísticas y los logros
lo recorren miles de veces. Para subir desde una región ya cargada, ver Region.hacia_arriba.
"""
from collections.abc import Iterator
from dataclasses import dataclass

from .models import Region


@dataclass(frozen=True)
class Nodo:
    id: int
    codigo: str
    nombre: str
    nivel: str
    padre_id: int | None
    continente: str


class ArbolRegiones:
    def __init__(self):
        self.nodos: dict[int, Nodo] = {
            fila[0]: Nodo(*fila)
            for fila in Region.objects.values_list('id', 'codigo', 'nombre', 'nivel', 'padre_id', 'continente')
        }

    def hacia_arriba(self, region_id: int | None) -> Iterator[Nodo]:
        """La región y las que la contienen, de la más chica a la más grande."""
        while region_id is not None:
            nodo = self.nodos[region_id]
            yield nodo
            region_id = nodo.padre_id

    def subir_hasta(self, region_id: int, nivel: str) -> Nodo | None:
        """La primera de ese nivel, empezando por ella misma. None si no hay ninguna: un país no tiene provincia."""
        return next((nodo for nodo in self.hacia_arriba(region_id) if nodo.nivel == nivel), None)
