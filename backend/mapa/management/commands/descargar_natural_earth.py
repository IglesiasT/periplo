"""
Descarga Natural Earth admin-0 (países) y admin-1 (provincias) del mundo entero,
normaliza sus campos y genera versiones simplificadas con mapshaper para el mapa.

Salidas:
    backend/data/raw/{paises,provincias}.geojson   completos, los lee `cargar_regiones`
    frontend/public/geo/{paises,provincias}.geojson simplificados, los dibuja MapLibre

Uso:
    python manage.py descargar_natural_earth
    python manage.py descargar_natural_earth --simplificar-provincias 15% --forzar-descarga
"""
import geopandas as gpd
import pandas as pd
import shapely
from django.core.management.base import BaseCommand, CommandError

from mapa.geodatos import GEO_DIR, RAW_DIR, ErrorGeodatos, descargar, simplificar

URL_BASE = 'https://naciscdn.org/naturalearth/10m/cultural'
ZIP_PAISES = 'ne_10m_admin_0_countries.zip'
ZIP_PROVINCIAS = 'ne_10m_admin_1_states_provinces.zip'

PATRON_ISO_3166_2 = r'^[A-Z]{2}-[A-Z0-9]+$'

# Islas del Atlántico Sur: Natural Earth las trae como territorios británicos aparte (FLK y SGS).
# En este mapa son argentinas: se integran al país ARG y a la provincia de Tierra del Fuego,
# Antártida e Islas del Atlántico Sur (AR-V), igual que en la capa de departamentos del IGN.
# No se usa la versión "punto de vista argentino" de Natural Earth porque trae errores
# (le agrega Barbados a Uruguay) y cambia otras disputas ajenas a este proyecto.
ISLAS_ATLANTICO_SUR = ['FLK', 'SGS']
ARGENTINA = 'ARG'
TIERRA_DEL_FUEGO = 'AR-V'


def anexar(gdf: gpd.GeoDataFrame, destino: str, origen: pd.Series) -> gpd.GeoDataFrame:
    """Une las geometrías marcadas en `origen` a la región `destino` y las saca como regiones propias."""
    if not origen.any():
        return gdf
    gdf = gdf.copy()
    fila = gdf.index[gdf['codigo'] == destino]
    if len(fila) != 1:
        raise CommandError(f'No se encontró la región {destino} para anexarle territorio.')
    union = shapely.union_all([gdf.at[fila[0], 'geometry'], *gdf.loc[origen, 'geometry']])
    gdf.loc[fila, 'geometry'] = gpd.GeoSeries([union], index=fila, crs=gdf.crs)
    return gdf[~origen]


def normalizar_paises(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    # ADM0_A3 es único y es el que usan las provincias para referir a su país.
    # (ISO_A3 no sirve: Francia y Noruega figuran como -99.)
    gdf = gdf.rename(columns={'ADM0_A3': 'codigo', 'NAME_ES': 'nombre', 'CONTINENT': 'continente'})[
        ['codigo', 'nombre', 'continente', 'geometry']
    ]
    return anexar(gdf, ARGENTINA, gdf['codigo'].isin(ISLAS_ATLANTICO_SUR))


def normalizar_provincias(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    # ISO 3166-2 cuando es válido y no está repetido; si no, adm1_code (propio de Natural Earth, siempre único).
    iso = gdf['iso_3166_2']
    iso_usable = iso.str.match(PATRON_ISO_3166_2, na=False) & ~iso.duplicated(keep=False)
    gdf = gdf.assign(codigo=iso.where(iso_usable, gdf['adm1_code']))
    gdf = gdf.rename(columns={'name': 'nombre', 'adm0_a3': 'padre'})[['codigo', 'nombre', 'padre', 'geometry']]
    return anexar(gdf, TIERRA_DEL_FUEGO, gdf['padre'].isin(ISLAS_ATLANTICO_SUR))


class Command(BaseCommand):
    help = 'Descarga países y provincias de Natural Earth y genera los GeoJSON del mapa.'

    def add_arguments(self, parser):
        parser.add_argument('--simplificar-paises', default='10%',
                            help='Porcentaje de vértices que conserva mapshaper en países (default: 10%%).')
        parser.add_argument('--simplificar-provincias', default='10%',
                            help='Porcentaje de vértices que conserva mapshaper en provincias (default: 10%%).')
        parser.add_argument('--forzar-descarga', action='store_true',
                            help='Vuelve a descargar los zips aunque ya existan en data/raw/.')

    def handle(self, *args, **opts):
        capas = [
            ('paises', ZIP_PAISES, normalizar_paises, opts['simplificar_paises']),
            ('provincias', ZIP_PROVINCIAS, normalizar_provincias, opts['simplificar_provincias']),
        ]
        for nombre, zip_nombre, normalizar, porcentaje in capas:
            zip_path = RAW_DIR / zip_nombre
            if descargar(f'{URL_BASE}/{zip_nombre}', zip_path, opts['forzar_descarga']):
                self.stdout.write(f'Descargado {zip_nombre}')

            gdf = normalizar(gpd.read_file(zip_path)).to_crs('EPSG:4326').sort_values('codigo')
            if not gdf['codigo'].is_unique:
                raise CommandError(f'Hay códigos repetidos en {nombre}.')
            crudo = RAW_DIR / f'{nombre}.geojson'
            gdf.to_file(crudo, driver='GeoJSON')
            self.stdout.write(f'{nombre}: {len(gdf)} regiones -> {crudo.name}')

            try:
                kb = simplificar(crudo, GEO_DIR / f'{nombre}.geojson', porcentaje)
            except ErrorGeodatos as e:
                raise CommandError(str(e)) from e
            self.stdout.write(self.style.SUCCESS(f'  simplificado -> {nombre}.geojson ({kb:,.0f} KB)'))
