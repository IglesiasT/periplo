import os
import threading

from django.apps import AppConfig


class MapaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'mapa'

    def ready(self):
        import pyogrio

        from . import respaldos, signals  # noqa: F401  (signals registra las señales)

        # GDAL rechaza por defecto los GeoJSON con objetos de más de 200 MB, como la capa del IGN.
        pyogrio.set_gdal_config_options({'OGR_GEOJSON_MAX_OBJ_SIZE': 0})

        # Solo en el proceso que atiende de `runserver`, no en cada `manage.py` ni en los tests.
        if os.environ.get('RUN_MAIN') == 'true':
            threading.Thread(target=respaldos.al_arrancar, daemon=True).start()
