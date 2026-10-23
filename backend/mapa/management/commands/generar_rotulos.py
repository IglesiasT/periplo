"""
Genera los puntos donde el mapa escribe los nombres de países, provincias, océanos y mares.

Para cada región toma su parte más grande (Argentina continental, no Malvinas; Francia europea,
no la Guayana) y calcula su polo de inaccesibilidad: el punto más alejado del borde, donde el
nombre entra mejor. Si MapLibre rotulara los polígonos directamente, repetiría el nombre en cada
isla y en cada tile. Los océanos y mares no tienen geometría: sus puntos están definidos acá.

Lee los GeoJSON simplificados de frontend/public/geo/ (los que se dibujan) y escribe
frontend/public/geo/rotulos.geojson.

Uso:
    python manage.py generar_rotulos
"""
import json

import geopandas as gpd
from django.core.management.base import BaseCommand, CommandError
from shapely.geometry import MultiPolygon
from shapely.ops import polylabel

from mapa.geodatos import CRS_AREAS_IGUALES, GEO_DIR

# (nombre, nivel, lon, lat). El nivel decide desde qué zoom aparece: océanos siempre,
# mares al alejarse un poco menos, y mares menores, golfos y estrechos solo de cerca.
AGUAS = [
    ('Océano Atlántico', 'oceano', -40, 28),
    ('Océano Atlántico', 'oceano', -18, -24),
    ('Océano Pacífico', 'oceano', -140, 12),
    ('Océano Pacífico', 'oceano', -112, -32),
    ('Océano Índico', 'oceano', 78, -18),
    ('Océano Glacial Ártico', 'oceano', 100, 79),
    ('Océano Austral', 'oceano', 20, -60),
    ('Mar Argentino', 'mar', -58, -45),
    ('Mar Caribe', 'mar', -75, 15),
    ('Golfo de México', 'mar', -90, 25),
    ('Mar Mediterráneo', 'mar', 18, 35),
    ('Mar del Norte', 'mar', 3, 56),
    ('Mar Báltico', 'mar', 19.5, 58),
    ('Mar Negro', 'mar', 34, 43.3),
    ('Mar Caspio', 'mar', 51, 42),
    ('Mar Rojo', 'mar', 38, 21),
    ('Mar Arábigo', 'mar', 64, 15),
    ('Golfo de Bengala', 'mar', 88, 15),
    ('Mar de la China Meridional', 'mar', 114, 13),
    ('Mar de la China Oriental', 'mar', 126, 29),
    ('Mar de Japón', 'mar', 135, 40),
    ('Mar de Ojotsk', 'mar', 150, 54),
    ('Mar de Bering', 'mar', -178, 58),
    ('Mar de Coral', 'mar', 155, -18),
    ('Mar de Tasmania', 'mar', 160, -38),
    ('Bahía de Hudson', 'mar', -85, 59),
    ('Golfo de Alaska', 'mar', -145, 56),
    ('Mar de Noruega', 'mar', 2, 68),
    ('Mar de Barents', 'mar', 40, 73),
    ('Golfo de Guinea', 'mar', 3, 2),
    ('Pasaje de Drake', 'mar', -65, -58),
    ('Mar de Weddell', 'mar', -45, -70),
    ('Mar de Ross', 'mar', -175, -75),
    ('Golfo Pérsico', 'mar-menor', 51.5, 27),
    ('Mar Egeo', 'mar-menor', 25, 38.5),
    ('Mar Adriático', 'mar-menor', 15.5, 43),
    ('Mar Tirreno', 'mar-menor', 12, 40),
    ('Mar de Mármara', 'mar-menor', 28, 40.7),
    ('Río de la Plata', 'mar-menor', -57, -35.2),
    ('Golfo San Matías', 'mar-menor', -64.5, -41.6),
    ('Golfo San Jorge', 'mar-menor', -66.8, -46),
    ('Estrecho de Magallanes', 'mar-menor', -70.5, -53.6),
]


def punto_de_rotulo(geometria):
    """Polo de inaccesibilidad de la parte más grande, con una tolerancia proporcional a su tamaño."""
    parte = max(geometria.geoms, key=lambda p: p.area) if isinstance(geometria, MultiPolygon) else geometria
    minx, miny, maxx, maxy = parte.bounds
    return polylabel(parte, tolerance=max(maxx - minx, maxy - miny) / 100)


class Command(BaseCommand):
    help = 'Genera frontend/public/geo/rotulos.geojson con los puntos de los nombres del mapa.'

    def handle(self, *args, **opts):
        features = []
        for archivo, nivel in [('paises.geojson', 'pais'), ('provincias.geojson', 'provincia')]:
            ruta = GEO_DIR / archivo
            if not ruta.exists():
                raise CommandError(f'No existe {ruta}. Corré antes `python manage.py descargar_natural_earth`.')
            gdf = gpd.read_file(ruta)
            gdf = gdf[gdf.geometry.notna() & gdf['nombre'].notna()]
            areas = gdf.geometry.to_crs(CRS_AREAS_IGUALES).area / 1_000_000
            for fila, area in zip(gdf.itertuples(), areas):
                punto = punto_de_rotulo(fila.geometry)
                features.append(self.feature(punto.x, punto.y, nombre=fila.nombre, nivel=nivel, codigo=fila.codigo,
                                             area_km2=round(area)))

        for nombre, nivel, lon, lat in AGUAS:
            features.append(self.feature(lon, lat, nombre=nombre, nivel=nivel))

        destino = GEO_DIR / 'rotulos.geojson'
        with destino.open('w', encoding='utf-8') as f:
            json.dump({'type': 'FeatureCollection', 'features': features}, f, ensure_ascii=False,
                      separators=(',', ':'))
        self.stdout.write(self.style.SUCCESS(
            f'{len(features)} rótulos en {destino} ({destino.stat().st_size / 1024:.0f} KB).'))

    @staticmethod
    def feature(lon, lat, **propiedades):
        return {
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [round(lon, 3), round(lat, 3)]},
            'properties': propiedades,
        }
