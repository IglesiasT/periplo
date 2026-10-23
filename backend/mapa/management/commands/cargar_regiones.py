"""
Carga países, provincias y departamentos en el modelo Region, con su jerarquía y el área precalculada.

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
from django.db.models import ProtectedError

from mapa.models import Region

RAW_DIR = Path(settings.BASE_DIR) / 'data' / 'raw'

# Mollweide: proyección de áreas iguales válida para todo el planeta (incluida la Antártida).
CRS_AREAS_IGUALES = 'ESRI:54009'


def leer_con_area(path: Path) -> gpd.GeoDataFrame:
    if not path.exists():
        raise CommandError(f'No existe {path}. Corré antes `python manage.py descargar_natural_earth`.')
    gdf = gpd.read_file(path)
    # El sector antártico del IGN llega exactamente al polo, donde la proyección da NaN: se recorta a -89,99°.
    geometrias = gdf.geometry.clip_by_rect(-180, -89.99, 180, 90)
    gdf['area_km2'] = geometrias.to_crs(CRS_AREAS_IGUALES).area / 1_000_000
    return gdf


class Command(BaseCommand):
    help = 'Carga las regiones (países, provincias y departamentos) desde los GeoJSON de data/raw/.'

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

        # Departamentos (IGN, solo Argentina): opcionales, si ya se corrió descargar_departamentos_ign.
        departamentos = []
        if (RAW_DIR / 'departamentos.geojson').exists():
            departamentos = leer_con_area(RAW_DIR / 'departamentos.geojson')
            id_provincia = dict(Region.objects.filter(nivel=Region.Nivel.PROVINCIA).values_list('codigo', 'id'))
            self.upsert([
                Region(nivel=Region.Nivel.DEPARTAMENTO, codigo=f.codigo, nombre=f.nombre,
                       padre_id=id_provincia[f.padre], area_km2=round(f.area_km2, 1))
                for f in departamentos.itertuples()
            ])

        # Regiones que ya no están en los archivos (por ejemplo FLK y SGS, ahora parte de ARG): se borran.
        self.borrar_obsoletas(Region.Nivel.PAIS, set(paises['codigo']))
        self.borrar_obsoletas(Region.Nivel.PROVINCIA, set(provincias['codigo']))
        if len(departamentos):
            self.borrar_obsoletas(Region.Nivel.DEPARTAMENTO, set(departamentos['codigo']))

        self.stdout.write(self.style.SUCCESS(
            f'{len(paises)} países, {len(provincias)} provincias y {len(departamentos)} departamentos cargados '
            f'({Region.objects.count()} regiones en total).'
        ))

    def borrar_obsoletas(self, nivel: str, vigentes: set[str]):
        for region in Region.objects.filter(nivel=nivel).exclude(codigo__in=vigentes):
            try:
                region.delete()  # en cascada con sus subregiones
                self.stdout.write(f'Borrada {region}: ya no está en los datos.')
            except ProtectedError:
                self.stdout.write(self.style.WARNING(
                    f'{region} ya no está en los datos pero tiene visitas: no se borró. Reasignalas desde el admin.'))

    def upsert(self, regiones: list[Region]):
        # Un solo INSERT ... ON CONFLICT(codigo) DO UPDATE en lugar de miles de consultas.
        Region.objects.bulk_create(
            regiones,
            batch_size=500,
            update_conflicts=True,
            unique_fields=['codigo'],
            update_fields=['nivel', 'nombre', 'padre', 'area_km2', 'continente'],
        )
