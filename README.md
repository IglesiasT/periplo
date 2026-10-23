# Periplo

Mapa y diario de viajes personal: un mapa que se pinta a medida que viajo, al estilo de los juegos de grand strategy.

La visión, el modelo de datos y las fases están en [CLAUDE.md](CLAUDE.md).

## Estado actual: MVP

- Provincias argentinas de Natural Earth en un mapa MapLibre.
- Salta, Jujuy y Tucumán pintadas como visitadas desde un JSON hardcodeado (`backend/mapa/data/visitas_mvp.json`), servido por Django en `GET /api/visitas/`.

## Estructura

```
backend/    Django + Django REST Framework + SQLite
  config/   proyecto Django (settings, urls)
  mapa/     app: endpoint /api/visitas/ y management commands geográficos
frontend/   React + TypeScript + Vite + MapLibre GL
  public/geo/argentina-provincias.geojson   geometrías simplificadas (generadas)
```

## Requisitos

- Python 3.12+
- Node.js 22+

## Cómo levantarlo (Windows, PowerShell)

Se necesitan dos terminales: una para el backend y otra para el frontend.

### Backend (http://127.0.0.1:8000)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python manage.py migrate
.venv\Scripts\python manage.py runserver
```

> Si preferís activar el entorno con `.venv\Scripts\Activate.ps1` y PowerShell lo bloquea, corré una vez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. Los comandos de arriba no lo necesitan.

### Frontend (http://localhost:5173)

```powershell
cd frontend
npm install
npm run dev
```

Abrí http://localhost:5173. Vite reenvía las llamadas a `/api` hacia Django (ver `frontend/vite.config.ts`), así que el backend tiene que estar corriendo para que se pinten las provincias visitadas.

## Regenerar el GeoJSON de provincias

El archivo `frontend/public/geo/argentina-provincias.geojson` ya está commiteado. Para regenerarlo, con las dependencias de backend y frontend instaladas:

```powershell
cd backend
.venv\Scripts\python manage.py descargar_natural_earth
```

El comando:

1. Descarga `ne_10m_admin_1_states_provinces.zip` de Natural Earth a `backend/data/raw/`, que está ignorado por git y funciona como caché.
2. Filtra Argentina (`adm0_a3 == "ARG"`) con geopandas y deja solo `codigo` (ISO 3166-2) y `nombre`.
3. Simplifica con mapshaper, preservando las fronteras compartidas.

Opciones: `--simplificar 30%` conserva más vértices; el default es 20%. `--forzar-descarga` vuelve a bajar el zip.

## Fuentes de datos

- [Natural Earth](https://www.naturalearthdata.com/): dominio público.
