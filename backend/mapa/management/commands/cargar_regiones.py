"""
Carga países y provincias en el modelo Region, con su jerarquía y el área precalculada.

Lee los GeoJSON completos que deja `descargar_natural_earth` en data/raw/.
Se puede correr varias veces: actualiza las regiones existentes por `codigo`.

Uso:
    python manage.py cargar_regiones
"""
from pathlib import Path

import geopandas as gpd
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from mapa.models import Region

RAW_DIR = Path(settings.BASE_DIR) / 'data' / 'raw'

# Mollweide: proyección de áreas iguales válida para todo el planeta (incluida la Antártida).
CRS_AREAS_IGUALES = 'ESRI:54009'


def leer_con_area(path: Path) -> gpd.GeoDataFrame:
    if not path.exists():
        raise CommandError(f'No existe {path}. Corré antes `python manage.py descargar_natural_earth`.')
    gdf = gpd.read_file(path)
    gdf['area_km2'] = gdf.geometry.to_crs(CRS_AREAS_IGUALES).area / 1_000_000
    return gdf


class Command(BaseCommand):
    help = 'Carga las regiones (países y provincias) desde los GeoJSON de Natural Earth.'

    @transaction.atomic
    def handle(self, *args, **opts):
        paises = leer_con_area(RAW_DIR / 'paises.geojson')
        provincias = leer_con_area(RAW_DIR / 'provincias.geojson')

        self.upsert([
            Region(nivel=Region.Nivel.PAIS, codigo=f.codigo, nombre=f.nombre,
                   continente=f.continente, area_km2=round(f.area_km2, 1))
            for f in paises.itertuples()
        ])

        # Las provincias apuntan a su país por código; lo traducimos a la clave primaria.
        id_pais = dict(Region.objects.filter(nivel=Region.Nivel.PAIS).values_list('codigo', 'id'))
        self.upsert([
            Region(nivel=Region.Nivel.PROVINCIA, codigo=f.codigo, nombre=f.nombre,
                   padre_id=id_pais[f.padre], area_km2=round(f.area_km2, 1))
            for f in provincias.itertuples()
        ])

        self.stdout.write(self.style.SUCCESS(
            f'{len(paises)} países y {len(provincias)} provincias cargados '
            f'({Region.objects.count()} regiones en total).'
        ))

    def upsert(self, regiones: list[Region]):
        # Un solo INSERT ... ON CONFLICT(codigo) DO UPDATE en lugar de miles de consultas.
        Region.objects.bulk_create(
            regiones,
            batch_size=500,
            update_conflicts=True,
            unique_fields=['codigo'],
            update_fields=['nivel', 'nombre', 'padre', 'area_km2', 'continente'],
        )
