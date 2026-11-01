"""
Cruza cada Region con cada snapshot de historical-basemaps y guarda a qué entidad pertenecía
en EntidadPoliticaHistorica y RegionEpoca. De cada entidad en cada año guarda además dónde va su
nombre en el mapa y con qué aguada se pinta (EntidadEpoca).

Lee las regiones de data/raw/{paises,provincias,departamentos}.geojson y los snapshots que
deja `descargar_historia` en data/raw/historia/. Se puede correr varias veces: cada año
cruzado reemplaza lo que había para ese año.

Uso:
    python manage.py cruzar_historia
    python manage.py cruzar_historia --anios 1500 1800 1900 --umbral 5
"""
import re

import geopandas as gpd
import pandas as pd
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from mapa.epocas import aplicar_nombres_es
from mapa.geodatos import RAW_DIR
from mapa.historia import cruzar, describir_entidades, preparar_regiones
from mapa.management.commands.descargar_historia import HISTORIA_DIR
from mapa.models import EntidadEpoca, EntidadPoliticaHistorica, Region, RegionEpoca

CAPAS_REGIONES = ['paises', 'provincias', 'departamentos']
PATRON_NORMALIZADO = re.compile(r'^(-?\d+)\.geojson$')


def snapshots_disponibles() -> dict[int, object]:
    return {int(m[1]): ruta for ruta in HISTORIA_DIR.glob('*.geojson')
            if (m := PATRON_NORMALIZADO.match(ruta.name))}


class Command(BaseCommand):
    help = 'Cruza las regiones con los snapshots históricos y guarda a qué entidad pertenecía cada una.'

    def add_arguments(self, parser):
        parser.add_argument('--anios', type=int, nargs='+',
                            help='Años a cruzar; los a. C. van en negativo (default: todos los descargados).')
        parser.add_argument('--umbral', type=float, default=1.0,
                            help='Porcentaje mínimo de la región para registrar una entidad (default: 1).')
        parser.add_argument('--max-distancia-km', type=float, default=50,
                            help='Distancia máxima para asignar la entidad más cercana a una región '
                                 'que no toca ninguna (default: 50).')

    def handle(self, *args, **opts):
        disponibles = snapshots_disponibles()
        if not disponibles:
            raise CommandError(f'No hay snapshots en {HISTORIA_DIR}. Corré antes `python manage.py descargar_historia`.')
        anios = sorted(opts['anios'] or disponibles)
        if faltantes := [a for a in anios if a not in disponibles]:
            raise CommandError(f'No hay snapshot para: {", ".join(map(str, faltantes))}.')

        id_region = dict(Region.objects.values_list('codigo', 'id'))
        if not id_region:
            raise CommandError('No hay regiones en la base. Corré antes `python manage.py cargar_regiones`.')
        regiones = self.leer_regiones(set(id_region))
        self.stdout.write(f'{len(regiones)} regiones preparadas; cruzando {len(anios)} años.')

        for anio in anios:
            snapshot = gpd.read_file(disponibles[anio])
            cruce = cruzar(regiones, snapshot, umbral_pct=opts['umbral'], max_distancia_km=opts['max_distancia_km'])
            self.guardar(anio, cruce, describir_entidades(snapshot), id_region)
            sin_entidad = len(regiones) - cruce['codigo'].nunique()
            self.stdout.write(
                f'{anio}: {len(cruce)} filas, {cruce["entidad"].nunique()} entidades, '
                f'{sin_entidad} regiones sin entidad')

        # Las entidades nuevas llegan sin traducir.
        traducidas = aplicar_nombres_es()
        self.stdout.write(self.style.SUCCESS(
            f'{EntidadPoliticaHistorica.objects.count()} entidades ({traducidas} traducidas) y '
            f'{RegionEpoca.objects.count()} filas de RegionEpoca en total.'))

    def leer_regiones(self, codigos: set[str]) -> gpd.GeoDataFrame:
        capas = []
        for nombre in CAPAS_REGIONES:
            ruta = RAW_DIR / f'{nombre}.geojson'
            if ruta.exists():
                capas.append(gpd.read_file(ruta, columns=['codigo']))
        regiones = pd.concat(capas, ignore_index=True)
        return preparar_regiones(regiones[regiones['codigo'].isin(codigos)])

    @transaction.atomic
    def guardar(self, anio: int, cruce: pd.DataFrame, entidades: pd.DataFrame, id_region: dict[str, int]):
        # Todas las del snapshot, aunque no ocupen ninguna región: igual llevan su nombre en el mapa.
        nombres = set(entidades['nombre']) | set(cruce['entidad'])
        EntidadPoliticaHistorica.objects.bulk_create([EntidadPoliticaHistorica(nombre=n) for n in nombres],
                                                     ignore_conflicts=True)
        id_entidad = dict(EntidadPoliticaHistorica.objects.filter(nombre__in=nombres).values_list('nombre', 'id'))

        RegionEpoca.objects.filter(anio=anio).delete()
        RegionEpoca.objects.bulk_create([
            RegionEpoca(region_id=id_region[f.codigo], anio=anio, entidad_id=id_entidad[f.entidad],
                        porcentaje_superficie=None if pd.isna(f.porcentaje) else f.porcentaje)
            for f in cruce.itertuples()
        ], batch_size=1000)

        EntidadEpoca.objects.filter(anio=anio).delete()
        EntidadEpoca.objects.bulk_create([
            EntidadEpoca(anio=anio, entidad_id=id_entidad[f.nombre], lon=f.lon, lat=f.lat,
                         area_km2=f.area_km2, tono=f.tono)
            for f in entidades.itertuples()
        ], batch_size=1000)
