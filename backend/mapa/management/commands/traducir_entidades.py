"""
Copia los nombres en castellano de data/entidades_es.json a las entidades históricas.

`cruzar_historia` ya lo hace al terminar: este comando es para después de editar el JSON,
sin volver a cruzar todo.

Uso:
    python manage.py traducir_entidades
"""
from django.core.management.base import BaseCommand

from mapa.epocas import NOMBRES_ES, aplicar_nombres_es
from mapa.models import EntidadPoliticaHistorica


class Command(BaseCommand):
    help = 'Aplica los nombres en castellano de data/entidades_es.json a las entidades históricas.'

    def handle(self, *args, **opts):
        traducidas = aplicar_nombres_es()
        self.stdout.write(self.style.SUCCESS(
            f'{traducidas} de {EntidadPoliticaHistorica.objects.count()} entidades traducidas '
            f'desde {NOMBRES_ES.name}.'))
