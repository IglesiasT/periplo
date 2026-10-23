"""Cruce de las Region con un snapshot de historical-basemaps: qué entidad ocupaba cada región."""
import geopandas as gpd
import numpy as np
import pandas as pd
import shapely

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
