# Periplo

Mapa y diario de viajes personal: un mapa que se pinta a medida que viajo, al estilo de los juegos de grand strategy.

La visión, el modelo de datos y las fases están en [CLAUDE.md](CLAUDE.md).

## Estado actual: Fases 1 y 2

**El mapa (Fase 1)**
- Mapa mundial en MapLibre con países y provincias de Natural Earth, y departamentos argentinos del IGN.
- Zoom semántico: de lejos se ven países, al acercarse aparecen las provincias y, en Argentina, desde el zoom 7 los departamentos.
- Colores por estado:
  - gris para sin visitar;
  - azul semitransparente con contorno para la lista de deseos;
  - color con intensidad según el tipo de presencia (estadía, de paso o tránsito) para lo visitado.
- Viajes y visitas sincronizados desde Notion (bases Destinations y Lugares).
- La vista queda en la URL (`#zoom/lat/lon`): al recargar se mantiene y se puede guardar un enlace a una zona.

**El diario (Fase 2)**, todo desde el panel lateral:
- **Viajes:** crear, editar y borrar. Los que vienen de Notion solo admiten editar fechas y notas.
- **Marcar en el mapa:** con un viaje abierto, cada click en una región avanza su estado: estadía → de paso → tránsito → deseo → sin marcar. Marca el nivel que se ve (país, provincia o departamento).
- **Rutas:**
  - importar GPX o KML, o dibujarlas en el mapa (Enter termina, Escape descarta);
  - se guarda su longitud real en km;
  - "Marcar regiones atravesadas" agrega como tránsito todo lo que cruza la ruta.
- **Fotos:**
  - subir JPG, PNG o WebP;
  - si tienen GPS en el EXIF, aparecen en el mapa (agrupadas cuando están cerca) y se ubican en su región;
  - si el viaje no tiene esa región, el panel ofrece sumarla.
- **Estadísticas:** % del mundo y km² recorridos, km de rutas, países por continente y avance por país.
  - Solo cuentan las visitas realizadas, no los deseos.
  - De las regiones visitadas se suman solo las que no están dentro de otra visitada, para no contar dos veces: si marcaste Jujuy entera, Tilcara ya está incluida.
  - Los km de rutas son solo los de viajes hechos.

## Estructura

```
backend/     Django + Django REST Framework + SQLite
  config/    proyecto Django (settings, urls)
  mapa/      app: modelos, API (/api/viajes, visitas, rutas, fotos, estados, estadisticas)
             y management commands geográficos
  data/raw/  descargas y GeoJSON completos (ignorado por git, se regenera)
  media/     fotos subidas y miniaturas (ignorado por git)
frontend/    React + TypeScript + Vite + MapLibre GL + TanStack Query + terra-draw
  public/geo/{paises,provincias,departamentos}.geojson   geometrías simplificadas (generadas y commiteadas)
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
.venv\Scripts\python manage.py descargar_departamentos_ign  # baja los departamentos del IGN (~140 MB)
.venv\Scripts\python manage.py cargar_regiones           # 256 países, 4594 provincias y 529 departamentos, con su área
.venv\Scripts\python manage.py sincronizar_notion        # viajes y visitas desde Notion (ver abajo)
.venv\Scripts\python manage.py createsuperuser           # para cargar viajes desde /admin/
```

Sin Notion, `loaddata viaje_ejemplo` carga un viaje de ejemplo (Salta, Jujuy y Tucumán).

## Sincronizar con Notion

Configuración, una sola vez:

1. Creá una integración interna en https://www.notion.so/profile/integrations y poné su token en `backend/.env` como `NOTION_TOKEN`.
2. Compartí la página **Travel Planner** con la integración: menú `•••` → **Connections**. Así ve Destinations y Lugares.
3. Poné el ID de la base Destinations (los 32 caracteres de su URL) como `NOTION_DATABASE_ID`.

Después, cada vez que actualices Notion:

```powershell
cd backend
.venv\Scripts\python manage.py sincronizar_notion --dry-run   # muestra qué haría, sin guardar
.venv\Scripts\python manage.py sincronizar_notion
```

- Cada destino es un `Viaje`, y sus Lugares se vuelven `Visita` en la región donde caen sus coordenadas. Si un Lugar está "Planeado", se pinta como deseo.
- Los Lugares que no cuelgan de ningún destino se vuelven visitas sin viaje.
- Los destinos sin Place ni Lugares se ubican por nombre: primero contra las regiones y después con Nominatim. Nominatim solo acepta países, provincias y ciudades, y sus respuestas se guardan en caché en `data/raw/nominatim_cache.json`. Con `--sin-nominatim` no se hacen consultas externas.
- El comando lista lo que no pudo ubicar ("Europa central", "Balcanes"…). Para esos casos, agregales `Place` en Notion o cargá la visita a mano en el admin.
- Las visitas que crea el sync se regeneran en cada corrida y las que cargues a mano no se tocan. Nunca borra viajes.

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

`descargar_departamentos_ign`:

1. Baja la capa **Departamento** del IGN por WFS. Son 529 departamentos, partidos y comunas.
2. Arma el código a partir del código INDEC (`AR-66028`) y deduce la provincia de sus dos primeros dígitos (`66` es Salta, `AR-A`).
3. Simplifica al 1% con `--simplificar` como opción, lo que da unos 1,3 MB.

Incluye Antártida Argentina e Islas del Atlántico Sur tal como las publica el IGN.

**Islas del Atlántico Sur:** Malvinas, Georgias del Sur y Sandwich del Sur son territorio argentino en todos los niveles del mapa. Natural Earth las trae como territorios británicos aparte (`FLK` y `SGS`). `descargar_natural_earth` las integra al país `ARG` y a la provincia de Tierra del Fuego (`AR-V`). Si `FLK` o `SGS` quedaran en la base, `cargar_regiones` los borra.

`cargar_regiones` lee los GeoJSON completos, calcula el área en la proyección de áreas iguales Mollweide y hace upsert por `codigo`, así que se puede correr varias veces. Si existe el GeoJSON de departamentos, los carga también.

El sync con Notion ubica los **Lugares** argentinos en su departamento (Tilcara, General Pueyrredón…). Los **Destinos** quedan a nivel provincia, porque "Catamarca" se refiere a toda la provincia.

## Fuentes de datos

- [Natural Earth](https://www.naturalearthdata.com/): países y provincias del mundo, de dominio público.
- **FUENTE: Instituto Geográfico Nacional de la República Argentina**: capa Departamento, con la geometría modificada por última vez el 11/11/2019, de [Capas SIG](https://www.ign.gob.ar/NuestrasActividades/InformacionGeoespacial/CapasSIG).
  - Uso y redistribución libres y gratuitos, citando la fuente y la fecha; el mapa lo hace en sus créditos.
  - Este proyecto no está asociado ni avalado por el IGN.
- [Nominatim](https://nominatim.org/) / OpenStreetMap: geocodificación de nombres, respetando su política de uso (1 pedido por segundo).
- API de Notion: bases Destinations y Lugares del Travel Planner.
