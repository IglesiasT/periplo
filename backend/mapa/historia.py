"""Cruce de las Region con un snapshot de historical-basemaps: qué entidad ocupaba cada región."""
import geopandas as gpd
import numpy as np
import pandas as pd
import shapely
from shapely.ops import polylabel
from shapely.strtree import STRtree

from .geodatos import CRS_AREAS_IGUALES

# Las fronteras históricas son mucho más gruesas que las de Natural Earth: simplificar las
# regiones a 1 km no cambia los porcentajes y hace el cruce varias veces más rápido.
TOLERANCIA_M = 1_000


def preparar_regiones(regiones: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Proyecta y simplifica las regiones una sola vez, para cruzarlas con todos los snapshots."""
    # La Antártida llega al polo, donde Mollweide da NaN: se recorta a -89,99°.
    geometrias = regiones.geometry.clip_by_rect(-180, -89.99, 180, 90).to_crs(CRS_AREAS_IGUALES)
    geometrias = geometrias.simplify(TOLERANCIA_M).make_valid()
    return gpd.GeoDataFrame({'codigo': regiones['codigo'].values}, geometry=geometrias.values, crs=CRS_AREAS_IGUALES)


def cruzar(regiones: gpd.GeoDataFrame, snapshot: gpd.GeoDataFrame,
           umbral_pct: float = 1.0, max_distancia_km: float = 50) -> pd.DataFrame:
    """Devuelve una fila por (codigo, entidad) con el porcentaje de la región que ocupaba.

    `regiones` viene de `preparar_regiones`; `snapshot` es un año normalizado por
    `descargar_historia`, con columna `nombre`.

    - El porcentaje se calcula sobre la parte de la región que cae en alguna entidad, no sobre
      el total: las costas de historical-basemaps son gruesas y dejan afuera franjas litorales
      (el centro de Buenos Aires queda en el agua). Las entidades por debajo de `umbral_pct` se descartan.
    - Una región que no toca ninguna entidad (una isla que el snapshot no dibuja) se asigna a la
      más cercana si está a menos de `max_distancia_km`, con porcentaje vacío. Si no, queda sin entidad.
    """
    snapshot = snapshot.to_crs(CRS_AREAS_IGUALES)
    geom_snapshot = snapshot.geometry.make_valid().values
    geom_regiones = regiones.geometry.values

    i_region, i_entidad = snapshot.sindex.query(geom_regiones, predicate='intersects')
    areas = shapely.area(shapely.intersection(geom_regiones[i_region], geom_snapshot[i_entidad]))
    pares = pd.DataFrame({
        'codigo': regiones['codigo'].values[i_region],
        'entidad': snapshot['nombre'].values[i_entidad],
        'area': areas,
    })
    # La misma entidad puede tocar la región con varios polígonos si el snapshot no estaba disuelto.
    pares = pares[pares['area'] > 0].groupby(['codigo', 'entidad'], as_index=False)['area'].sum()
    pares['porcentaje'] = 100 * pares['area'] / pares.groupby('codigo')['area'].transform('sum')
    pares = pares[pares['porcentaje'] >= umbral_pct]

    sin_entidad = ~np.isin(regiones['codigo'].values, pares['codigo'].unique())
    cercanas = pd.DataFrame(columns=['codigo', 'entidad', 'porcentaje'])
    if sin_entidad.any():
        i_sin, i_cercana = snapshot.sindex.nearest(
            geom_regiones[sin_entidad], max_distance=max_distancia_km * 1000, return_all=False)
        cercanas = pd.DataFrame({
            'codigo': regiones['codigo'].values[sin_entidad][i_sin],
            'entidad': snapshot['nombre'].values[i_cercana],
            'porcentaje': None,
        })

    resultado = pd.concat([pares[['codigo', 'entidad', 'porcentaje']], cercanas], ignore_index=True)
    resultado['porcentaje'] = resultado['porcentaje'].astype(float).round(1)
    return resultado.sort_values(['codigo', 'porcentaje'], ascending=[True, False], ignore_index=True)


# Cuántas aguadas reparte la coloración. Cada tema tiene que tener al menos estas (ver tema/tipos.ts).
CANTIDAD_TONOS = 10

# Dos entidades a menos de esto (en grados) son vecinas: las fronteras de historical-basemaps son
# aproximadas y dejan huecos chicos entre territorios que en realidad se tocan.
DISTANCIA_VECINAS_GRADOS = 0.1


def hash_nombre(texto: str) -> int:
    """FNV-1a sobre las unidades UTF-16 del texto. A diferencia de hash(), no cambia de una corrida a otra:
    es lo que le da a cada entidad su color de siempre."""
    h = 0x811C9DC5
    unidades = texto.encode('utf-16-le')
    for i in range(0, len(unidades), 2):
        h ^= unidades[i] | (unidades[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def _punto_de_rotulo(geometria):
    """Centro visual de la parte más grande: el punto más alejado del borde, donde el nombre entra mejor."""
    parte = max(geometria.geoms, key=lambda p: p.area) if hasattr(geometria, 'geoms') else geometria
    if parte.geom_type != 'Polygon':
        return parte.representative_point()
    minx, miny, maxx, maxy = parte.bounds
    return polylabel(parte, tolerance=max(maxx - minx, maxy - miny) / 100)


def describir_entidades(snapshot: gpd.GeoDataFrame, cantidad_tonos: int = CANTIDAD_TONOS) -> pd.DataFrame:
    """Una fila por entidad del snapshot: nombre, lon y lat de su rótulo, area_km2 y tono.

    El tono es la aguada con la que se pinta: de la más grande a la más chica, cada entidad se queda con
    su color de siempre (el de su nombre) salvo que ya lo tenga una vecina; entonces toma el primero libre.
    Así las vecinas casi nunca comparten color y una entidad conserva el suyo de un año a otro.
    """
    geometrias = list(snapshot.geometry)
    nombres = list(snapshot['nombre'])
    areas = snapshot.geometry.clip_by_rect(-180, -89.99, 180, 90).to_crs(CRS_AREAS_IGUALES).area.values / 1_000_000

    vecinas: list[set[int]] = [set() for _ in geometrias]
    izquierda, derecha = STRtree(geometrias).query(geometrias, predicate='dwithin', distance=DISTANCIA_VECINAS_GRADOS)
    for a, b in zip(izquierda, derecha):
        if a != b:
            vecinas[int(a)].add(int(b))
            vecinas[int(b)].add(int(a))

    tonos: dict[int, int] = {}
    for i in sorted(range(len(geometrias)), key=lambda i: -areas[i]):
        usados = {tonos[v] for v in vecinas[i] if v in tonos}
        preferido = hash_nombre(nombres[i]) % cantidad_tonos
        libre = next((t for t in range(cantidad_tonos) if t not in usados), preferido)
        tonos[i] = preferido if preferido not in usados else libre

    puntos = [_punto_de_rotulo(g) for g in geometrias]
    return pd.DataFrame({
        'nombre': nombres,
        'lon': [round(p.x, 3) for p in puntos],
        'lat': [round(p.y, 3) for p in puntos],
        'area_km2': [round(float(a)) for a in areas],
        'tono': [tonos[i] for i in range(len(geometrias))],
    })
