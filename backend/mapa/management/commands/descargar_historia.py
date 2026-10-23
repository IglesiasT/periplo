"""
Descarga los snapshots de historical-basemaps (fronteras del mundo en distintos años)
y los normaliza: una fila por entidad política, con geometría válida.

Fuente: https://github.com/aourednik/historical-basemaps (GPL-3.0). Las fronteras son
aproximadas y no cubren todos los años: sirven para un diario personal, no como fuente académica.
Por la licencia, los derivados quedan solo en data/raw/ (fuera del repo) hasta decidir otra cosa.

Salidas:
    backend/data/raw/historia/world_<anio>.geojson   originales, como vienen
    backend/data/raw/historia/<anio>.geojson         normalizados, los lee el cruce con las Region

Uso:
    python manage.py descargar_historia
    python manage.py descargar_historia --desde 1500 --forzar-descarga
"""
import json
import re
import urllib.request

import geopandas as gpd
from django.core.management.base import BaseCommand, CommandError

from mapa.geodatos import RAW_DIR, descargar

REPO = 'aourednik/historical-basemaps'
URL_LISTADO = f'https://api.github.com/repos/{REPO}/contents/geojson'
URL_ARCHIVO = f'https://raw.githubusercontent.com/{REPO}/master/geojson'
HISTORIA_DIR = RAW_DIR / 'historia'

# world_1800.geojson -> 1800, world_bc500.geojson -> -500
PATRON_SNAPSHOT = re.compile(r'^world_(bc)?(\d+)\.geojson$')


def anio_de(nombre_archivo: str) -> int | None:
    m = PATRON_SNAPSHOT.match(nombre_archivo)
    if m is None:
        return None
    return -int(m[2]) if m[1] else int(m[2])


def listar_snapshots() -> dict[int, str]:
    """Año -> nombre de archivo, según lo que hay hoy en el repo."""
    req = urllib.request.Request(URL_LISTADO, headers={'User-Agent': 'periplo/0.1'})
    with urllib.request.urlopen(req) as resp:
        archivos = [item['name'] for item in json.load(resp)]
    return {anio: nombre for nombre in archivos if (anio := anio_de(nombre)) is not None}


def normalizar(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Una fila por entidad. Una misma entidad viene partida en varios polígonos (colonias,
    islas), así que se disuelve por nombre. Los polígonos sin nombre son tierra sin entidad
    asignada en ese año y se descartan."""
    gdf = gdf[gdf['NAME'].notna() & (gdf['NAME'].str.strip() != '')].copy()
    gdf['nombre'] = gdf['NAME'].str.strip()
    # SUBJECTO dice de quién dependía ese territorio en ese año ("Spain" para el Virreinato
    # de Nueva España). Si es la misma entidad, no depende de nadie.
    sujeto = gdf['SUBJECTO'].fillna('').str.strip()
    gdf['sujeta_a'] = sujeto.where(sujeto != gdf['nombre'], '')
    gdf['geometry'] = gdf.geometry.make_valid()
    return (
        gdf[['nombre', 'sujeta_a', 'geometry']]
        .dissolve(by='nombre', aggfunc='first', as_index=False)
        .set_crs('EPSG:4326', allow_override=True)
        .sort_values('nombre')
    )


class Command(BaseCommand):
    help = 'Descarga los snapshots de historical-basemaps y los normaliza para cruzarlos con las regiones.'

    def add_arguments(self, parser):
        parser.add_argument('--desde', type=int, default=None,
                            help='Primer año a descargar; los a. C. van en negativo (default: todos).')
        parser.add_argument('--hasta', type=int, default=None, help='Último año a descargar (default: todos).')
        parser.add_argument('--forzar-descarga', action='store_true',
                            help='Vuelve a descargar los archivos aunque ya existan en data/raw/historia/.')

    def handle(self, *args, **opts):
        try:
            snapshots = listar_snapshots()
        except OSError as e:
            raise CommandError(f'No se pudo listar los archivos de {REPO}: {e}') from e

        desde, hasta = opts['desde'], opts['hasta']
        anios = sorted(a for a in snapshots
                       if (desde is None or a >= desde) and (hasta is None or a <= hasta))
        if not anios:
            raise CommandError('No hay snapshots en ese rango de años.')

        for anio in anios:
            archivo = snapshots[anio]
            crudo = HISTORIA_DIR / archivo
            if descargar(f'{URL_ARCHIVO}/{archivo}', crudo, opts['forzar_descarga']):
                self.stdout.write(f'Descargado {archivo}')

            gdf = normalizar(gpd.read_file(crudo))
            gdf.to_file(HISTORIA_DIR / f'{anio}.geojson', driver='GeoJSON')
            self.stdout.write(f'{anio}: {len(gdf)} entidades')

        self.stdout.write(self.style.SUCCESS(f'{len(anios)} snapshots en {HISTORIA_DIR}'))
