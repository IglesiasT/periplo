from django.apps import AppConfig


class MapaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'mapa'

    def ready(self):
        import pyogrio

        # GDAL rechaza por defecto los GeoJSON con objetos de más de 200 MB, como la capa del IGN.
        pyogrio.set_gdal_config_options({'OGR_GEOJSON_MAX_OBJ_SIZE': 0})
