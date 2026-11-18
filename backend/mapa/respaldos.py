"""
Respaldos en .zip de lo que no se puede regenerar: viajes, visitas, fichas y fotos. Las regiones y la capa histórica
no van: salen de los comandos de datos. Las regiones se guardan por código, no por id: sirve aunque se vuelvan a cargar.

Además de `manage.py respaldar`, el servidor hace uno solo al arrancar si el último es viejo (ver apps.py). Esos llevan
otro nombre y son los únicos que se borran para hacer lugar: un respaldo hecho a mano no se toca nunca.
"""
import io
import logging
import os
import time
import zipfile
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.db import connection
from django.utils import timezone

logger = logging.getLogger(__name__)

MODELOS = ['mapa.Viaje', 'mapa.Visita', 'mapa.Foto', 'mapa.FichaRegion']
ARCHIVO_DATOS = 'diario.json'
CARPETA_MEDIA = 'media'
PREFIJO_MANUAL = 'periplo-'
PREFIJO_AUTOMATICO = 'periplo-auto-'
SEGUNDOS_POR_DIA = 86400


def crear_respaldo(destino: Path, prefijo: str = PREFIJO_MANUAL, ahora: datetime | None = None) -> tuple[Path, int]:
    """Devuelve la ruta del .zip y cuántos archivos de fotos lleva."""
    destino.mkdir(parents=True, exist_ok=True)
    ruta = destino / f'{prefijo}{(ahora or timezone.localtime()):%Y%m%d-%H%M%S}.zip'

    datos = io.StringIO()
    call_command('dumpdata', *MODELOS, natural_foreign=True, indent=1, stdout=datos)

    media = Path(settings.MEDIA_ROOT)
    archivos = [p for p in media.rglob('*') if p.is_file()] if media.exists() else []
    # Primero con otro nombre: si el servidor se apaga a la mitad, no queda un .zip roto que parezca un respaldo.
    temporal = ruta.with_suffix('.tmp')
    with zipfile.ZipFile(temporal, 'w', zipfile.ZIP_DEFLATED) as respaldo:
        respaldo.writestr(ARCHIVO_DATOS, datos.getvalue())
        for archivo in archivos:
            respaldo.write(archivo, Path(CARPETA_MEDIA) / archivo.relative_to(media))
    os.replace(temporal, ruta)
    return ruta, len(archivos)


def hace_falta(destino: Path, dias: int) -> bool:
    """Cuenta cualquier respaldo, manual o automático: lo que importa es qué tan viejo es el último."""
    fechas = [p.stat().st_mtime for p in destino.glob(f'{PREFIJO_MANUAL}*.zip')]
    return not fechas or time.time() - max(fechas) > dias * SEGUNDOS_POR_DIA


def podar(destino: Path, conservar: int) -> list[Path]:
    """Borra los automáticos más viejos, dejando `conservar`. Devuelve los que borró."""
    automaticos = sorted(destino.glob(f'{PREFIJO_AUTOMATICO}*.zip'), key=lambda p: p.stat().st_mtime, reverse=True)
    sobrantes = automaticos[conservar:]
    for archivo in sobrantes:
        archivo.unlink()
    return sobrantes


def respaldar_si_hace_falta() -> Path | None:
    """Lo que hace el servidor al arrancar. Devuelve la ruta del respaldo, si hizo uno."""
    destino = Path(settings.RESPALDOS_DIR)
    if not hace_falta(destino, settings.RESPALDO_CADA_DIAS):
        return None
    ruta, _ = crear_respaldo(destino, PREFIJO_AUTOMATICO)
    podar(destino, settings.RESPALDOS_A_CONSERVAR)
    return ruta


def al_arrancar():
    """Corre en un hilo aparte: un respaldo que falla (disco lleno, una carpeta que ya no está) se avisa en la
    consola, pero no puede impedir que la app arranque."""
    try:
        respaldar_si_hace_falta()
    except Exception:
        logger.exception('No se pudo hacer el respaldo automático.')
    finally:
        connection.close()
