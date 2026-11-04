"""
Respalda en un .zip lo que no se puede regenerar: viajes, visitas, fichas y fotos. Las regiones y la capa
histórica no van: salen de los comandos de datos.

Las regiones se guardan por código, no por id: el respaldo sirve aunque se vuelvan a cargar.
Un respaldo en el mismo disco no sobrevive a que se rompa el disco: conviene `--destino` a otro lugar.

Uso:
    python manage.py respaldar
    python manage.py respaldar --destino D:/respaldos

Para restaurar (con las regiones ya cargadas), ver "Respaldos" en el README.
"""
import io
import zipfile
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone

DESTINO_POR_DEFECTO = Path(settings.BASE_DIR) / 'respaldos'
MODELOS = ['mapa.Viaje', 'mapa.Visita', 'mapa.Foto', 'mapa.FichaRegion']
ARCHIVO_DATOS = 'diario.json'
CARPETA_MEDIA = 'media'


class Command(BaseCommand):
    help = 'Guarda viajes, visitas, fichas y fotos en un .zip.'

    def add_arguments(self, parser):
        parser.add_argument('--destino', type=Path, default=DESTINO_POR_DEFECTO,
                            help=f'Carpeta donde dejarlo (por defecto, {DESTINO_POR_DEFECTO}).')

    def handle(self, *args, **opts):
        destino: Path = opts['destino']
        destino.mkdir(parents=True, exist_ok=True)
        ruta = destino / f'periplo-{timezone.localtime():%Y%m%d-%H%M%S}.zip'

        datos = io.StringIO()
        call_command('dumpdata', *MODELOS, natural_foreign=True, indent=1, stdout=datos)

        media = Path(settings.MEDIA_ROOT)
        archivos = [p for p in media.rglob('*') if p.is_file()] if media.exists() else []
        with zipfile.ZipFile(ruta, 'w', zipfile.ZIP_DEFLATED) as respaldo:
            respaldo.writestr(ARCHIVO_DATOS, datos.getvalue())
            for archivo in archivos:
                respaldo.write(archivo, Path(CARPETA_MEDIA) / archivo.relative_to(media))

        self.stdout.write(self.style.SUCCESS(f'{ruta} ({len(archivos)} archivos de fotos).'))
