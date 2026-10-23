"""
Sincroniza la base Destinations de Notion (y su base relacionada Lugares) con Viaje y Visita.

- Cada destino es un Viaje (upsert por notion_id).
- Las visitas creadas por este comando (desde_notion=True) se regeneran en cada corrida;
  las que cargues a mano no se tocan.
- Nunca borra viajes: si un destino desaparece de Notion, solo lo avisa.

Uso:
    python manage.py sincronizar_notion --dry-run    # muestra qué haría, sin guardar
    python manage.py sincronizar_notion
    python manage.py sincronizar_notion --sin-nominatim
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from mapa.models import Region, Viaje, Visita
from mapa.notion import ClienteNotion, ErrorNotion, parsear_destino, parsear_lugar
from mapa.sincronizacion import planificar_visitas
from mapa.ubicacion import Ubicador


class Command(BaseCommand):
    help = 'Crea y actualiza viajes y visitas a partir de la base Destinations de Notion.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Muestra el resultado sin guardar nada.')
        parser.add_argument('--sin-nominatim', action='store_true',
                            help='No consulta Nominatim para los destinos que solo tienen nombre.')

    def handle(self, *args, **opts):
        if not settings.NOTION_DATABASE_ID:
            raise CommandError('Falta NOTION_DATABASE_ID en backend/.env.')
        if not Region.objects.exists():
            raise CommandError('No hay regiones cargadas. Corré antes `python manage.py cargar_regiones`.')

        try:
            cliente = ClienteNotion(settings.NOTION_TOKEN)
            base = cliente.base(settings.NOTION_DATABASE_ID)
            # La base Lugares se descubre a partir de la relación, sin otra variable de entorno.
            lugares_db_id = base['properties']['Lugares']['relation']['database_id']
            destinos = [parsear_destino(p) for p in cliente.filas(settings.NOTION_DATABASE_ID)]
            lugares = [parsear_lugar(p) for p in cliente.filas(lugares_db_id)]
        except ErrorNotion as e:
            raise CommandError(f'Error de Notion: {e}') from e
        self.stdout.write(f'Notion: {len(destinos)} destinos y {len(lugares)} lugares.')

        ubicador = Ubicador(usar_nominatim=not opts['sin_nominatim'])
        visitas, sin_ubicar = planificar_visitas(destinos, lugares, ubicador)

        with transaction.atomic():
            viajes = {}
            for destino in destinos:
                viajes[destino.notion_id], _ = Viaje.objects.update_or_create(
                    notion_id=destino.notion_id,
                    defaults={'nombre': destino.nombre, 'estado': destino.estado},
                )

            Visita.objects.filter(desde_notion=True).delete()
            # Si ya cargaste a mano la misma región en el mismo viaje, se respeta la tuya.
            manuales = set(Visita.objects.values_list('viaje_id', 'region__codigo'))
            region_id = dict(Region.objects.values_list('codigo', 'id'))
            nuevas = []
            for v in visitas:
                viaje = viajes.get(v.viaje_notion_id)
                if (viaje and viaje.id, v.codigo) in manuales:
                    continue
                nuevas.append(Visita(viaje=viaje, region_id=region_id[v.codigo],
                                     realizada=v.realizada, desde_notion=True))
            Visita.objects.bulk_create(nuevas)

            self.reportar(destinos, visitas, sin_ubicar)
            if opts['dry_run']:
                transaction.set_rollback(True)
                self.stdout.write(self.style.WARNING('--dry-run: no se guardó nada.'))
            else:
                self.stdout.write(self.style.SUCCESS(
                    f'{len(viajes)} viajes y {len(nuevas)} visitas sincronizados.'))

    def reportar(self, destinos, visitas, sin_ubicar):
        nombres = dict(Region.objects.values_list('codigo', 'nombre'))
        por_viaje: dict[str | None, list] = {}
        for v in visitas:
            por_viaje.setdefault(v.viaje_notion_id, []).append(v)

        def linea(v):
            marca = 'visitado' if v.realizada else 'deseo'
            return f'    {nombres[v.codigo]} ({v.codigo}) - {marca} <- {v.origen}'

        for destino in destinos:
            self.stdout.write(f'  {destino.nombre} [{destino.estado}]')
            for v in por_viaje.get(destino.notion_id, []):
                self.stdout.write(linea(v))
        if None in por_viaje:
            self.stdout.write('  Lugares sin viaje')
            for v in por_viaje[None]:
                self.stdout.write(linea(v))

        if sin_ubicar:
            self.stdout.write(self.style.WARNING(
                f'Sin ubicar ({len(sin_ubicar)}): agregales Place en Notion o cargalos a mano desde el admin.'))
            for nombre in sin_ubicar:
                self.stdout.write(f'  - {nombre}')

        ids_notion = {d.notion_id for d in destinos}
        huerfanos = Viaje.objects.exclude(notion_id__isnull=True).exclude(notion_id__in=ids_notion)
        for viaje in huerfanos:
            self.stdout.write(self.style.WARNING(f'"{viaje}" ya no está en Notion (no se borró).'))
