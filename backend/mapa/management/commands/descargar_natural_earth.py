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
import shutil
import subprocess
import urllib.request
from pathlib import Path

import geopandas as gpd
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

URL_BASE = 'https://naciscdn.org/naturalearth/10m/cultural'
ZIP_PAISES = 'ne_10m_admin_0_countries.zip'
ZIP_PROVINCIAS = 'ne_10m_admin_1_states_provinces.zip'

RAW_DIR = Path(settings.BASE_DIR) / 'data' / 'raw'
FRONTEND_DIR = Path(settings.BASE_DIR).parent / 'frontend'
GEO_DIR = FRONTEND_DIR / 'public' / 'geo'

PATRON_ISO_3166_2 = r'^[A-Z]{2}-[A-Z0-9]+$'


def normalizar_paises(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    # ADM0_A3 es único y es el que usan las provincias para referir a su país.
    # (ISO_A3 no sirve: Francia y Noruega figuran como -99.)
    return gdf.rename(columns={'ADM0_A3': 'codigo', 'NAME_ES': 'nombre', 'CONTINENT': 'continente'})[
        ['codigo', 'nombre', 'continente', 'geometry']
    ]


def normalizar_provincias(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    # ISO 3166-2 cuando es válido y no está repetido; si no, adm1_code (propio de Natural Earth, siempre único).
    iso = gdf['iso_3166_2']
    iso_usable = iso.str.match(PATRON_ISO_3166_2, na=False) & ~iso.duplicated(keep=False)
    gdf = gdf.assign(codigo=iso.where(iso_usable, gdf['adm1_code']))
    return gdf.rename(columns={'name': 'nombre', 'adm0_a3': 'padre'})[['codigo', 'nombre', 'padre', 'geometry']]


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
        RAW_DIR.mkdir(parents=True, exist_ok=True)
        GEO_DIR.mkdir(parents=True, exist_ok=True)

        capas = [
            ('paises', ZIP_PAISES, normalizar_paises, opts['simplificar_paises']),
            ('provincias', ZIP_PROVINCIAS, normalizar_provincias, opts['simplificar_provincias']),
        ]
        for nombre, zip_nombre, normalizar, porcentaje in capas:
            zip_path = self.descargar(zip_nombre, opts['forzar_descarga'])

            gdf = normalizar(gpd.read_file(zip_path)).to_crs('EPSG:4326').sort_values('codigo')
            if not gdf['codigo'].is_unique:
                raise CommandError(f'Hay códigos repetidos en {nombre}.')
            crudo = RAW_DIR / f'{nombre}.geojson'
            gdf.to_file(crudo, driver='GeoJSON')
            self.stdout.write(f'{nombre}: {len(gdf)} regiones -> {crudo.name}')

            self.simplificar(crudo, GEO_DIR / f'{nombre}.geojson', porcentaje)

    def descargar(self, zip_nombre: str, forzar: bool) -> Path:
        """Baja el zip a data/raw/ salvo que ya esté (caché: pesan varios MB y no cambian)."""
        zip_path = RAW_DIR / zip_nombre
        if forzar or not zip_path.exists():
            url = f'{URL_BASE}/{zip_nombre}'
            self.stdout.write(f'Descargando {url} ...')
            req = urllib.request.Request(url, headers={'User-Agent': 'periplo/0.1'})
            with urllib.request.urlopen(req) as resp, zip_path.open('wb') as f:
                shutil.copyfileobj(resp, f)
        return zip_path

    def simplificar(self, origen: Path, destino: Path, porcentaje: str):
        """Simplifica con mapshaper, que preserva las fronteras compartidas entre regiones vecinas."""
        npx = shutil.which('npx')
        if npx is None:
            raise CommandError('No se encontró npx. Instalá Node.js y corré `npm install` en frontend/.')
        subprocess.run(
            [
                npx, 'mapshaper', str(origen),
                '-simplify', porcentaje, 'keep-shapes',
                '-o', 'format=geojson', 'precision=0.001', str(destino),
            ],
            cwd=FRONTEND_DIR,
            check=True,
        )
        kb = destino.stat().st_size / 1024
        self.stdout.write(self.style.SUCCESS(f'  simplificado -> {destino.name} ({kb:,.0f} KB)'))
