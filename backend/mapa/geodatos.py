"""Utilidades compartidas por los comandos que bajan y preparan datos geográficos."""
import shutil
import subprocess
import urllib.request
from pathlib import Path

from django.conf import settings

RAW_DIR = Path(settings.BASE_DIR) / 'data' / 'raw'
FRONTEND_DIR = Path(settings.BASE_DIR).parent / 'frontend'
GEO_DIR = FRONTEND_DIR / 'public' / 'geo'


class ErrorGeodatos(Exception):
    pass


def descargar(url: str, destino: Path, forzar: bool = False) -> bool:
    """Baja `url` a `destino` salvo que ya exista (caché). Devuelve True si descargó."""
    if destino.exists() and not forzar:
        return False
    destino.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={'User-Agent': 'periplo/0.1'})
    with urllib.request.urlopen(req) as resp, destino.open('wb') as f:
        shutil.copyfileobj(resp, f)
    return True


def simplificar(origen: Path, destino: Path, porcentaje: str) -> float:
    """Simplifica con mapshaper, que preserva las fronteras compartidas entre regiones vecinas.
    Devuelve el tamaño del resultado en KB."""
    npx = shutil.which('npx')
    if npx is None:
        raise ErrorGeodatos('No se encontró npx. Instalá Node.js y corré `npm install` en frontend/.')
    destino.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            npx, 'mapshaper', str(origen),
            '-simplify', porcentaje, 'keep-shapes',
            '-o', 'format=geojson', 'precision=0.001', str(destino),
        ],
        cwd=FRONTEND_DIR,
        check=True,
    )
    return destino.stat().st_size / 1024
