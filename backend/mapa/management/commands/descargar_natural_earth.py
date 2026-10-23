"""
Descarga Natural Earth admin-1 (provincias), lo filtra a Argentina y lo simplifica con mapshaper.

Uso:
    python manage.py descargar_natural_earth
    python manage.py descargar_natural_earth --simplificar 30% --forzar-descarga
"""
import shutil
import subprocess
import urllib.request
from pathlib import Path

import geopandas as gpd
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

URL_ADMIN1 = 'https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip'

RAW_DIR = Path(settings.BASE_DIR) / 'data' / 'raw'
FRONTEND_DIR = Path(settings.BASE_DIR).parent / 'frontend'
DESTINO = FRONTEND_DIR / 'public' / 'geo' / 'argentina-provincias.geojson'


class Command(BaseCommand):
    help = 'Descarga las provincias argentinas de Natural Earth y genera un GeoJSON simplificado para el mapa.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--simplificar', default='20%',
            help='Porcentaje de vértices que conserva mapshaper (default: 20%%).',
        )
        parser.add_argument(
            '--forzar-descarga', action='store_true',
            help='Vuelve a descargar el zip aunque ya exista en data/raw/.',
        )

    def handle(self, *args, **opts):
        RAW_DIR.mkdir(parents=True, exist_ok=True)
        zip_path = RAW_DIR / 'ne_10m_admin_1_states_provinces.zip'

        # 1. Descarga (con caché: el zip pesa varios MB y no cambia)
        if opts['forzar_descarga'] or not zip_path.exists():
            self.stdout.write(f'Descargando {URL_ADMIN1} ...')
            req = urllib.request.Request(URL_ADMIN1, headers={'User-Agent': 'periplo/0.1'})
            with urllib.request.urlopen(req) as resp, zip_path.open('wb') as f:
                shutil.copyfileobj(resp, f)
        else:
            self.stdout.write(f'Usando el zip en caché: {zip_path.name}')

        # 2. Lectura y filtro. geopandas lee el shapefile directo desde el zip.
        mundo = gpd.read_file(zip_path)
        argentina = mundo[mundo['adm0_a3'] == 'ARG']
        if argentina.empty:
            raise CommandError('No se encontraron provincias de Argentina (adm0_a3 == "ARG").')

        # Solo los campos que usa el mapa, con los nombres del modelo Region.
        argentina = (
            argentina[['iso_3166_2', 'name', 'geometry']]
            .rename(columns={'iso_3166_2': 'codigo', 'name': 'nombre'})
            .to_crs('EPSG:4326')
            .sort_values('codigo')
        )
        crudo = RAW_DIR / 'argentina-provincias.geojson'
        argentina.to_file(crudo, driver='GeoJSON')
        self.stdout.write(f'{len(argentina)} jurisdicciones filtradas -> {crudo.name}')

        # 3. Simplificación con mapshaper, que preserva las fronteras compartidas.
        npx = shutil.which('npx')
        if npx is None:
            raise CommandError('No se encontró npx. Instalá Node.js y corré `npm install` en frontend/.')
        DESTINO.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                npx, 'mapshaper', str(crudo),
                '-simplify', opts['simplificar'], 'keep-shapes',
                '-o', 'format=geojson', 'precision=0.0001', str(DESTINO),
            ],
            cwd=FRONTEND_DIR,
            check=True,
        )
        kb = DESTINO.stat().st_size / 1024
        self.stdout.write(self.style.SUCCESS(f'GeoJSON simplificado: {DESTINO} ({kb:.0f} KB)'))
