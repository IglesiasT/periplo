"""
Descarga los departamentos de Argentina del IGN (con código INDEC) y genera su GeoJSON para el mapa.

FUENTE: Instituto Geográfico Nacional de la República Argentina, capa "Departamento"
(Capas SIG, servicio WFS). Licencia: uso y redistribución libres y gratuitos citando la fuente
y la fecha de los datos originales (geometría modificada por última vez el 11/11/2019).

Salidas:
    backend/data/raw/departamentos.geojson   completo, lo leen `cargar_regiones` y el sync
    frontend/public/geo/departamentos.geojson simplificado, lo dibuja MapLibre

Uso:
    python manage.py descargar_departamentos_ign
"""
import geopandas as gpd
from django.core.management.base import BaseCommand, CommandError

from mapa.geodatos import GEO_DIR, RAW_DIR, ErrorGeodatos, descargar, simplificar

URL_WFS = (
    'https://wms.ign.gob.ar/geoserver/ign/ows?service=WFS&version=1.0.0&request=GetFeature'
    '&typeName=ign%3Adepartamento&outputFormat=application%2Fjson'
)

# Los dos primeros dígitos del código INDEC son la provincia; acá su código ISO 3166-2.
INDEC_A_ISO = {
    '02': 'AR-C', '06': 'AR-B', '10': 'AR-K', '14': 'AR-X', '18': 'AR-W', '22': 'AR-H',
    '26': 'AR-U', '30': 'AR-E', '34': 'AR-P', '38': 'AR-Y', '42': 'AR-L', '46': 'AR-F',
    '50': 'AR-M', '54': 'AR-N', '58': 'AR-Q', '62': 'AR-R', '66': 'AR-A', '70': 'AR-J',
    '74': 'AR-D', '78': 'AR-Z', '82': 'AR-S', '86': 'AR-G', '90': 'AR-T', '94': 'AR-V',
}


def normalizar_departamentos(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    indec = gdf['in1'].str.zfill(5)
    desconocidas = set(indec.str[:2]) - INDEC_A_ISO.keys()
    if desconocidas:
        raise CommandError(f'Códigos de provincia INDEC sin equivalente ISO: {sorted(desconocidas)}')
    return gpd.GeoDataFrame(
        {
            'codigo': 'AR-' + indec,
            'nombre': gdf['nam'],
            'padre': indec.str[:2].map(INDEC_A_ISO),
        },
        geometry=gdf.geometry,
        crs=gdf.crs,
    )


class Command(BaseCommand):
    help = 'Descarga los departamentos argentinos del IGN y genera su GeoJSON.'

    def add_arguments(self, parser):
        parser.add_argument('--simplificar', default='1%',
                            help='Porcentaje de vértices que conserva mapshaper (default: 1%%).')
        parser.add_argument('--forzar-descarga', action='store_true',
                            help='Vuelve a descargar la capa aunque ya exista en data/raw/.')

    def handle(self, *args, **opts):
        original = RAW_DIR / 'ign_departamento.geojson'
        if descargar(URL_WFS, original, opts['forzar_descarga']):
            self.stdout.write(f'Descargada la capa Departamento del IGN ({original.stat().st_size / 1e6:.0f} MB)')

        gdf = normalizar_departamentos(gpd.read_file(original)).to_crs('EPSG:4326').sort_values('codigo')
        if not gdf['codigo'].is_unique:
            raise CommandError('Hay códigos INDEC repetidos.')
        crudo = RAW_DIR / 'departamentos.geojson'
        gdf.to_file(crudo, driver='GeoJSON')
        self.stdout.write(f'departamentos: {len(gdf)} regiones -> {crudo.name}')

        try:
            kb = simplificar(crudo, GEO_DIR / 'departamentos.geojson', opts['simplificar'])
        except ErrorGeodatos as e:
            raise CommandError(str(e)) from e
        self.stdout.write(self.style.SUCCESS(f'  simplificado -> departamentos.geojson ({kb:,.0f} KB)'))
        self.stdout.write('Recordá citar: FUENTE: Instituto Geográfico Nacional de la República Argentina.')
