"""
Rutas: lectura de GPX/KML, simplificación, longitud y regiones que atraviesan.
"""
import tempfile
from dataclasses import dataclass
from pathlib import Path

import geopandas as gpd
import pyogrio
from pyproj import Geod
from shapely import line_merge
from shapely.geometry import LineString, MultiLineString
from shapely.geometry.base import BaseGeometry

# Un GPX de celular trae un punto cada pocos metros: se simplifica a ~10 m (en grados, cerca del ecuador).
# Alcanza para dibujarla y casi no cambia la longitud.
TOLERANCIA_GRADOS = 0.0001

GEOD = Geod(ellps='WGS84')


class ErrorRuta(Exception):
    pass


@dataclass
class RutaLeida:
    nombre: str
    coordenadas: list[list[float]]   # [[lon, lat], ...]


def longitud_km(coordenadas: list[list[float]]) -> float:
    """Longitud geodésica: sigue la curvatura de la Tierra, no una recta en el plano."""
    return round(GEOD.geometry_length(LineString(coordenadas)) / 1000, 2)


def a_lineas(geometria: BaseGeometry) -> list[LineString]:
    """Un track puede venir en varios segmentos: se unen los que se tocan y el resto queda separado."""
    if isinstance(geometria, LineString):
        return [geometria]
    if isinstance(geometria, MultiLineString):
        unidas = line_merge(geometria)
        if isinstance(unidas, LineString):
            return [unidas]
        # Si no se pudo unir nada, se respeta el orden del archivo (line_merge lo cambia).
        partes = geometria if len(unidas.geoms) == len(geometria.geoms) else unidas
        return list(partes.geoms)
    return []  # puntos (waypoints) y polígonos no son rutas


def coordenadas_simplificadas(linea: LineString) -> list[list[float]]:
    simple = linea.simplify(TOLERANCIA_GRADOS, preserve_topology=False)
    return [[round(x, 6), round(y, 6)] for x, y, *_ in simple.coords]


def leer_archivo(contenido: bytes, nombre_archivo: str) -> list[RutaLeida]:
    """Lee las líneas de un GPX o KML. GDAL (vía pyogrio) entiende ambos formatos: no hacen falta librerías extra."""
    extension = Path(nombre_archivo).suffix.lower()
    if extension not in ('.gpx', '.kml'):
        raise ErrorRuta('El archivo tiene que ser .gpx o .kml.')
    base = Path(nombre_archivo).stem

    with tempfile.TemporaryDirectory() as carpeta:
        ruta_temporal = Path(carpeta) / f'ruta{extension}'
        ruta_temporal.write_bytes(contenido)
        try:
            capas = [nombre for nombre, _ in pyogrio.list_layers(ruta_temporal)]
        except Exception as e:
            raise ErrorRuta(f'No se pudo leer el archivo: {e}') from e
        # En GPX las líneas están en "tracks" (lo grabado) y "routes" (lo planificado); en KML, en cualquier capa.
        if extension == '.gpx':
            capas = [c for c in capas if c in ('tracks', 'routes')]

        leidas = []
        for capa in capas:
            gdf = gpd.read_file(ruta_temporal, layer=capa).to_crs('EPSG:4326')
            for fila in gdf.itertuples():
                nombre = str(getattr(fila, 'name', None) or getattr(fila, 'Name', None) or base)
                for linea in a_lineas(fila.geometry):
                    coords = coordenadas_simplificadas(linea)
                    if len(coords) >= 2:
                        leidas.append(RutaLeida(nombre, coords))

    if not leidas:
        raise ErrorRuta('El archivo no tiene recorridos (tracks o líneas).')
    if len(leidas) > 1:
        for i, ruta in enumerate(leidas, start=1):
            ruta.nombre = f'{ruta.nombre} ({i})'
    return leidas
