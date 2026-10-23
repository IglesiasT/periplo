# Periplo: mapa y diario de viajes personal

Definicion de la RAE: Periplo (del griego períplous, que significa «navegación alrededor») es un viaje o un recorrido en el que se visitan varios lugares.

## Visión

Registro personal que acompaña mis viajes y cruza tres intereses: los juegos de "pintar mapas" (grand strategy tipo Victoria 3), la historia y la geografía, y viajar por el mundo.

- Uso **personal y local**: lo veo en la compu, sin usuarios, sin deploy ni perfil público por ahora.
- **Notion sigue siendo donde planifico** los viajes (base "Destinations" dentro de Travel Planner). Este proyecto es el "después": el mapa, el diario y la capa histórica.
- Se construye en 3 capas o fases, en orden: **mapa que se pinta → diario → historia**.

## Stack

- **Backend:** Django + Django REST Framework + SQLite. SQLite alcanza para un uso personal local.
- **Frontend:** React + TypeScript + Vite, con **MapLibre GL** para el mapa.
- **Procesamiento geográfico:** scripts Python con **geopandas / shapely**, ejecutados como *management commands* de Django. Precalculan una sola vez los datos pesados (áreas, intersecciones con fronteras históricas) y guardan el resultado en la base. **No usar PostGIS ni GeoDjango.**
- **Notion:** la sincronización la hace el backend. La API de Notion no admite llamadas desde el navegador (CORS) y el token tiene que quedar del lado del servidor, en una variable de entorno.

## Modelo de datos inicial

Las geometrías **no** se guardan en la base: viven en archivos GeoJSON (simplificados) que sirve el backend o el frontend. La base guarda identificadores, relaciones y valores precalculados.

### Fases 1 y 2

- **`Region`**
  - `nivel`: país, provincia o departamento
  - `nombre`
  - `codigo`: ISO o código GADM; es el que lo vincula con la geometría del GeoJSON
  - `padre`: FK a `Region`, nullable
  - `area_km2`: precalculada en una proyección de áreas iguales
  - `continente`: solo en países, viene de Natural Earth
- **`Viaje`**
  - `nombre`, `fecha_inicio`, `fecha_fin`
  - `estado`: deseo, investigando, en curso o hecho; refleja el `Status` de Notion. Es descriptivo: lo que se pinta lo decide `Visita.realizada`
  - `notion_id`: nullable; vincula el viaje con su página de Notion
  - `notas`
- **`Visita`**
  - `viaje`: FK, nullable; un lugar puede estar visitado sin estar asociado a un viaje
  - `region`: FK
  - `tipo_presencia`: estadía, paso o tránsito; define la intensidad del color en el mapa
  - `realizada`: si es falso, todavía no fui y se pinta como deseo
  - `desde_notion`: la creó el sync, que la regenera en cada corrida
- **`Ruta`**
  - `viaje`: FK
  - `coordenadas`: LineString guardado como JSON
- **`Foto`**
  - `viaje` y/o `visita`: FK
  - `archivo`
  - `lat` y `lon`: opcionales; se leen del EXIF si están

### Fase 3

- **`EntidadPoliticaHistorica`**: imperio, reino, estado o cultura que aparece en los snapshots históricos.
  - `nombre`
  - `color`: opcional, para pintarla en el mapa
- **`RegionEpoca`**: a qué entidad pertenecía cada región en cada año disponible.
  - `region`: FK
  - `anio`
  - `entidad`: FK a `EntidadPoliticaHistorica`
  - `porcentaje_superficie`: opcional, para regiones que caen entre dos entidades
- **`RutaHistorica`**: Ruta de la Seda, Camino del Inca, recorrido de la independencia sudamericana, etc.
  - `nombre`
  - `descripcion`
  - `regiones`: M2M a `Region`; el progreso se calcula contra mis `Visita`

## Fases

### Fase 1: el mapa que se pinta

1. Descargar **Natural Earth** en sus niveles admin-0 (países) y admin-1 (provincias). Simplificar las geometrías con **mapshaper** para que el navegador las maneje sin problemas.
2. Escribir un management command que parsee esos GeoJSON y cargue las `Region`, con su jerarquía y el área precalculada.
3. Armar el mapa en MapLibre con colores por estado:
   - Gris: no visitado ("niebla de guerra").
   - Contorno o semitransparente: lista de deseos.
   - Color con intensidad según `tipo_presencia`: visitado.
4. Agregar zoom semántico: con zoom lejano se ven países y al acercarse aparecen las provincias, como el mapa de estados de Victoria 3.
5. Sincronizar con Notion: un management command lee la base **Destinations** y crea viajes y deseos.
   - Propiedades de la base: `Name` (title), `Status` (status: Not started / Investigando / In progress / Done!), `Place` (place, con lat/lon), `Tags` (multi-select por continente, Argentina o Concert), `Lugares` (relación con la base Lugares).
   - La API pública sí expone `Place` con `lat`/`lon`. La base **Lugares** también tiene `Place` y un `Estado` (Visitado / Planeado), que es el que decide si una visita está realizada. "In progress" significa "planificando", no "viajando".
   - Orden para ubicar: `Place` de los Lugares → `Place` del destino → nombre contra las `Region` → **Nominatim**, aceptando solo resultados de tipo país, provincia o ciudad. Las coordenadas se traducen a región con point-in-polygon.
6. Al final de la fase, cargar el nivel departamento con **GADM nivel 2**, empezando solo por Argentina porque es pesado.

### Fase 2: el diario

1. CRUD de viajes y visitas desde el frontend, idealmente haciendo click en el mapa para marcar regiones.
2. Rutas: dibujarlas a mano en el mapa o importarlas desde GPX o KML (por ejemplo, Google Maps Timeline).
3. Fotos: subida local. Si tienen GPS en el EXIF, se ubican solas en el mapa.
4. Estadísticas: % del mundo y de Argentina recorrido, km² visitados, km de rutas, países por continente.

### Fase 3: la historia

1. Descargar **historical-basemaps** (github.com/aourednik/historical-basemaps): GeoJSON del mundo en distintos años (1500, 1700, 1800, 1900, etc.).
2. Escribir un management command que cruce cada `Region` con cada snapshot y guarde el resultado en `EntidadPoliticaHistorica` y `RegionEpoca`.
   - Para regiones grandes, usar centroide o porcentaje de superficie, porque una región puede caer entre dos entidades.
3. Agregar un slider de años sobre mi mapa y un panel del tipo "en 1800 pisaste territorio de X entidades".
4. Fichas de región: texto en markdown escrito a mano al visitar cada lugar. No automatizarlo de entrada.
5. Rutas históricas y logros: se definen en código como conjuntos de regiones requeridas, y el progreso se calcula contra mis `Visita`.
   - Ejemplos de logros: "las 24 jurisdicciones argentinas", "todos los sucesores de la URSS", "las dos orillas del Bósforo".

**Ojo:** las fronteras de historical-basemaps son aproximadas y no cubren todos los años. Sirven para un diario personal, no como fuente académica.

## MVP de arranque

Un MVP de un fin de semana:

- Repo con Django y React/Vite levantados.
- Provincias argentinas de Natural Earth en el mapa.
- Salta, Jujuy y Tucumán pintadas como visitadas, desde un JSON hardcodeado. Todavía sin sincronizar con Notion.

Cuando eso se vea en pantalla, se suman las capas en el orden de las fases.

## Fuentes de datos

- **Natural Earth:** países y provincias. Dominio público.
- **GADM:** departamentos. Licencia de uso no comercial, sin problema para un proyecto personal.
- **historical-basemaps:** fronteras históricas.
- **Nominatim:** geocodificación, si hace falta.
- **API de Notion:** base Destinations del Travel Planner.
