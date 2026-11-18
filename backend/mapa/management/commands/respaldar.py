"""
Respalda en un .zip viajes, visitas, fichas y fotos (ver mapa/respaldos.py). El servidor además hace uno solo cada
tanto; este sirve para hacerlo a mano, antes de algo delicado o en otro lugar.

Un respaldo en el mismo disco no sobrevive a que se rompa el disco: conviene apuntarlo a otro lado, con `--destino`
o con RESPALDOS_DIR en backend/.env.

Uso:
    python manage.py respaldar
    python manage.py respaldar --destino D:/respaldos

Para restaurar (con las regiones ya cargadas), ver "Respaldos" en el README.
"""
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from mapa.respaldos import crear_respaldo


class Command(BaseCommand):
    help = 'Guarda viajes, visitas, fichas y fotos en un .zip.'

    def add_arguments(self, parser):
        parser.add_argument('--destino', type=Path, default=Path(settings.RESPALDOS_DIR),
                            help=f'Carpeta donde dejarlo (por defecto, {settings.RESPALDOS_DIR}).')

    def handle(self, *args, **opts):
        ruta, fotos = crear_respaldo(opts['destino'])
        self.stdout.write(self.style.SUCCESS(f'{ruta} ({fotos} archivos de fotos).'))
