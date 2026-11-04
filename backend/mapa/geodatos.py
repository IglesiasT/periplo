"""Utilidades compartidas por los comandos que bajan y preparan datos geográficos."""
import shutil
import subprocess
import urllib.request
from collections.abc import Iterable
from pathlib import Path

import geopandas as gpd
import shapely
from django.conf import settings
from shapely.geometry.base import BaseGeometry
from shapely.strtree import STRtree

RAW_DIR = Path(settings.BASE_DIR) / 'data' / 'raw'
FRONTEND_DIR = Path(settings.BASE_DIR).parent / 'frontend'
GEO_DIR = FRONTEND_DIR / 'public' / 'geo'

# Sin límite, un servidor que no contesta deja el comando colgado para siempre.
TIEMPO_MAXIMO_RED = 60  # segundos

# Mollweide: proyección de áreas iguales válida para todo el planeta (incluida la Antártida).
CRS_AREAS_IGUALES = 'ESRI:54009'

# Natural Earth trae algunos fragmentos sin nombre en ningún idioma (códigos "+99?"): se llaman así
# en vez de quedar vacíos, que terminaban como "nan" en la base. No se rotulan.
SIN_NOMBRE = 'Sin nombre'

# Partes de una región a menos de esta distancia (en grados) de otra que ya entra en su recuadro
# también entran: Tierra del Fuego con Argentina, Córcega con Francia, el rosario de Indonesia.
DISTANCIA_ENCUADRE_GRADOS = 5

Recuadro = list[float]  # [oeste, sur, este, norte], en grados


def encuadre(geometria: BaseGeometry, distancia: float = DISTANCIA_ENCUADRE_GRADOS) -> Recuadro:
    """Recuadro al que acercar el mapa para mostrar la región: su parte más grande y las que están
    cerca, encadenadas. Deja afuera los territorios lejanos (la Guayana de Francia, la Isla de Pascua de
    Chile, Alaska de Estados Unidos), que estirarían el recuadro hasta hacer la región ilegible."""
    partes = list(geometria.geoms) if hasattr(geometria, 'geoms') else [geometria]
    if len(partes) == 1:
        return list(partes[0].bounds)
    # La parte más grande se mide en áreas iguales: en grados, las islas polares parecerían enormes.
    areas = gpd.GeoSeries(partes, crs='EPSG:4326').clip_by_rect(-180, -89.99, 180, 90).to_crs(CRS_AREAS_IGUALES).area
    inicio = int(areas.values.argmax())
    arbol = STRtree(partes)
    elegidas, pendientes = {inicio}, [inicio]
    while pendientes:
        for vecina in arbol.query(partes[pendientes.pop()], predicate='dwithin', distance=distancia):
            if int(vecina) not in elegidas:
                elegidas.add(int(vecina))
                pendientes.append(int(vecina))
    recuadro = list(shapely.union_all([partes[i] for i in elegidas]).bounds)
    # Un recuadro de más de media vuelta cruza el antimeridiano (Rusia, Fiyi): queda la parte más grande.
    return list(partes[inicio].bounds) if recuadro[2] - recuadro[0] > 180 else recuadro


def unir_recuadros(recuadros: Iterable[Recuadro]) -> Recuadro | None:
    recuadros = list(recuadros)
    if not recuadros:
        return None
    oestes, sures, estes, nortes = zip(*recuadros)
    return [min(oestes), min(sures), max(estes), max(nortes)]


class ErrorGeodatos(Exception):
    pass


def descargar(url: str, destino: Path, forzar: bool = False) -> bool:
    """Baja `url` a `destino` salvo que ya exista (caché). Devuelve True si descargó."""
    if destino.exists() and not forzar:
        return False
    destino.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={'User-Agent': 'periplo/0.1'})
    with urllib.request.urlopen(req, timeout=TIEMPO_MAXIMO_RED) as resp, destino.open('wb') as f:
        shutil.copyfileobj(resp, f)
    return True


def simplificar(origen: Path, destino: Path, porcentaje: str) -> float:
    """Simplifica con mapshaper, que preserva las fronteras compartidas entre regiones vecinas.
    Devuelve el tamaño del resultado en KB."""
    npx = shutil.which('npx')
    if npx is None:
        raise ErrorGeodatos('No se encontró npx. Instalá Node.js y corré `npm install` en frontend/.')
    destino.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            npx, 'mapshaper', str(origen),
            '-simplify', porcentaje, 'keep-shapes',
            '-o', 'format=geojson', 'precision=0.001', str(destino),
        ],
        cwd=FRONTEND_DIR,
        check=True,
    )
    return destino.stat().st_size / 1024
