"""
Corre todas las verificaciones del proyecto y resume cuáles pasaron. Sale con error si alguna falló.

Uso (desde cualquier carpeta):
    python verificar.py
"""
import shutil
import socket
import subprocess
import sys
import time
from contextlib import contextmanager
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
BACKEND = RAIZ / 'backend'
FRONTEND = RAIZ / 'frontend'

# El Python del entorno del proyecto, en Windows o en cualquier otro sistema.
PYTHON = next(
    (str(p) for p in (BACKEND / '.venv/Scripts/python.exe', BACKEND / '.venv/bin/python') if p.exists()),
    sys.executable,
)
NPX = shutil.which('npx') or 'npx'

PASOS = [
    ('Ruff', BACKEND, [PYTHON, '-m', 'ruff', 'check', '.']),
    ('Migraciones al día', BACKEND, [PYTHON, 'manage.py', 'makemigrations', '--check', '--dry-run']),
    ('Tests del backend', BACKEND, [PYTHON, 'manage.py', 'test', 'mapa']),
    ('Tests del frontend', FRONTEND, [NPX, 'vitest', 'run']),
    ('TypeScript', FRONTEND, [NPX, 'tsc', '-b']),
    ('Oxlint', FRONTEND, [NPX, 'oxlint', '--deny-warnings', 'src']),
    ('Build', FRONTEND, [NPX, 'vite', 'build']),
]


def correr(nombre: str, carpeta: Path, comando: list[str]) -> bool:
    resultado = subprocess.run(comando, cwd=carpeta, capture_output=True, text=True, encoding='utf-8', errors='replace')
    print(f'{"ok   " if resultado.returncode == 0 else "FALLA"}  {nombre}', flush=True)
    if resultado.returncode != 0:
        print(resultado.stdout + resultado.stderr, flush=True)
    return resultado.returncode == 0


def esta_prendido(puerto: int) -> bool:
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(('127.0.0.1', puerto)) == 0


def apagar(proceso: subprocess.Popen):
    if sys.platform == 'win32':
        # npx lanza hijos: hay que apagar el árbol entero.
        subprocess.run(['taskkill', '/T', '/F', '/PID', str(proceso.pid)], capture_output=True)
    else:
        proceso.terminate()


@contextmanager
def servidores():
    """Los dos servidores prendidos durante el bloque: usa los que ya estén y apaga solo los que prendió."""
    propios = []
    if not esta_prendido(8000):
        propios.append(subprocess.Popen([PYTHON, 'manage.py', 'runserver', '8000', '--noreload'], cwd=BACKEND,
                                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    if not esta_prendido(5173):
        propios.append(subprocess.Popen([NPX, 'vite', '--strictPort'], cwd=FRONTEND,
                                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    try:
        for _ in range(120):
            if esta_prendido(8000) and esta_prendido(5173):
                break
            time.sleep(0.5)
        yield
    finally:
        for proceso in propios:
            apagar(proceso)


def main() -> int:
    # Una lista y no un any(): que se corran todas aunque falle la primera.
    resultados = [correr(*paso) for paso in PASOS]
    # Último: es lo que más tarda. Solo mira, no guarda nada en la base.
    with servidores():
        resultados.append(correr('Recorrido en Chrome', FRONTEND, ['node', 'e2e/recorrido.mjs']))
    return 0 if all(resultados) else 1


if __name__ == '__main__':
    sys.exit(main())
