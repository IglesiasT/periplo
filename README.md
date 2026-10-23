# Periplo

Mapa y diario de viajes personal: un mapa que se pinta a medida que viajo, al estilo de los juegos de grand strategy.

La visión, el modelo de datos y las fases están en [CLAUDE.md](CLAUDE.md).

## Estado actual: Fase 1 en curso

- Mapa mundial en MapLibre con países y provincias de Natural Earth.
- Zoom semántico: de lejos se ven países y al acercarse aparecen las provincias.
- Colores por estado: gris para sin visitar, azul semitransparente con contorno para la lista de deseos, y color con intensidad según el tipo de presencia (estadía, de paso o tránsito) para lo visitado.
- Regiones, viajes y visitas en SQLite (`Region`, `Viaje`, `Visita`). Por ahora se cargan desde el admin de Django o con fixtures; la sincronización con Notion viene después.

## Estructura

```
backend/    Django + Django REST Framework + SQLite
  config/   proyecto Django (settings, urls)
  mapa/     app: modelos, GET /api/estados/ y management commands geográficos
  data/raw/ descargas y GeoJSON completos (ignorado por git, se regenera)
frontend/   React + TypeScript + Vite + MapLibre GL
  public/geo/{paises,provincias}.geojson   geometrías simplificadas (generadas y commiteadas)
```

## Requisitos

- Python 3.12+
- Node.js 22+

## Primera vez (Windows, PowerShell)

### 1. Dependencias

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
cd ..\frontend
npm install
cd ..
```

### 2. Secretos

```powershell
cd backend
Copy-Item .env.example .env
# Generá una SECRET_KEY y pegala en .env como DJANGO_SECRET_KEY:
.venv\Scripts\python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
```

> Los secretos (la `SECRET_KEY` de Django y, más adelante, el token de Notion) van en `backend/.env`, que git ignora. Nunca los escribas en `settings.py` ni en otro archivo versionado.

### 3. Base de datos y regiones

Desde `backend/`:

```powershell
.venv\Scripts\python manage.py migrate
.venv\Scripts\python manage.py descargar_natural_earth   # baja Natural Earth a data/raw/ (~20 MB)
.venv\Scripts\python manage.py cargar_regiones           # carga 258 países y 4596 provincias con su área
.venv\Scripts\python manage.py loaddata viaje_ejemplo    # opcional: Salta, Jujuy y Tucumán de ejemplo
.venv\Scripts\python manage.py createsuperuser           # para cargar viajes desde /admin/
```

## Levantarlo

Se necesitan dos terminales.

```powershell
# Backend: http://127.0.0.1:8000 (admin en /admin/)
cd backend
.venv\Scripts\python manage.py runserver
```

```powershell
# Frontend: http://localhost:5173
cd frontend
npm run dev
```

Vite reenvía las llamadas a `/api` hacia Django (ver `frontend/vite.config.ts`), así que el backend tiene que estar corriendo para que se pinten las regiones.

> Si preferís activar el entorno con `.venv\Scripts\Activate.ps1` y PowerShell lo bloquea, corré una vez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. Los comandos de arriba no lo necesitan.

## Tests

```powershell
cd backend
.venv\Scripts\python manage.py test mapa
```

## Datos geográficos

`descargar_natural_earth`:

1. Descarga admin-0 (países) y admin-1 (provincias) a escala 10m en `backend/data/raw/`, que funciona como caché.
2. Normaliza los campos con geopandas: `codigo`, `nombre`, `padre` y `continente`.
   - Los países usan `ADM0_A3` (por ejemplo `ARG`).
   - Las provincias usan ISO 3166-2 (por ejemplo `AR-A`) cuando es válido y único; si no, `adm1_code` de Natural Earth.
3. Guarda los GeoJSON completos en `data/raw/` y los simplifica con mapshaper hacia `frontend/public/geo/`, preservando las fronteras compartidas.

Opciones: `--simplificar-paises 15%`, `--simplificar-provincias 15%` (el default es 10%) y `--forzar-descarga`.

`cargar_regiones` lee los GeoJSON completos, calcula el área en la proyección de áreas iguales Mollweide y hace upsert por `codigo`, así que se puede correr varias veces.

## Fuentes de datos

- [Natural Earth](https://www.naturalearthdata.com/): dominio público.
