"""
Corre todas las verificaciones del proyecto y resume cuáles pasaron. Sale con error si alguna falló.

Uso (desde cualquier carpeta):
    python verificar.py
"""
import shutil
import subprocess
import sys
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


def main() -> int:
    # Una lista y no un any(): que se corran todas aunque falle la primera.
    resultados = [correr(*paso) for paso in PASOS]
    return 0 if all(resultados) else 1


if __name__ == '__main__':
    sys.exit(main())
