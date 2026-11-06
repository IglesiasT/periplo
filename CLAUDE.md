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
  - **Todo color y toda fuente salen del tema** (`frontend/src/tema/`). No escribir colores en el CSS ni en los componentes: el CSS usa las variables que escribe el tema (`var(--papel)`), y el estilo del mapa se arma con `crearEstilo(tema)`. Para sumar un tema: un archivo nuevo con un `Tema` completo y una línea en `TEMAS`. Los tests (`npm test`) fallan si aparece un color fuera del tema.
- **Procesamiento geográfico:** scripts Python con **geopandas / shapely**, ejecutados como *management commands* de Django. Precalculan una sola vez los datos pesados (áreas, intersecciones con fronteras históricas) y guardan el resultado en la base. **No usar PostGIS ni GeoDjango.**
- **Notion:** la sincronización la hace el backend. La API de Notion no admite llamadas desde el navegador (CORS) y el token tiene que quedar del lado del servidor, en una variable de entorno.

## Modelo de datos inicial

Las geometrías **no** se guardan en la base: viven en archivos GeoJSON (simplificados) que sirve el backend o el frontend. La base guarda identificadores, relaciones y valores precalculados.

### Fases 1 y 2

- **`Region`**
  - `nivel`: país, provincia o departamento
  - `nombre`
  - `codigo`: es el que lo vincula con la geometría del GeoJSON
    - Países: `ADM0_A3` de Natural Earth (`ARG`).
    - Provincias: ISO 3166-2 (`AR-A`). Si el ISO falta o está repetido, `adm1_code` de Natural Earth.
    - Departamentos argentinos: `AR-` + código INDEC de 5 dígitos (`AR-66028`). ISO 3166-2 no llega a ese nivel en Argentina.
  - `padre`: FK a `Region`, nullable
  - `area_km2`: precalculada en una proyección de áreas iguales
  - `continente`: solo en países, viene de Natural Earth
  - `encuadre`: recuadro `[oeste, sur, este, norte]` al que se acerca el mapa al elegirla. Toma la parte más grande y las que están a menos de 5° encadenadas, para dejar afuera territorios lejanos (la Guayana de Francia, la Isla de Pascua de Chile)
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
- **`Foto`**
  - `viaje`: FK
  - `archivo` y `miniatura`: van a `backend/media/`, que está fuera del repo
  - `lat`, `lon` y `tomada_en`: opcionales; se leen del EXIF si están
  - `region`: región donde cae la foto, calculada al subirla
  - `descripcion`

### Fase 3

- **`EntidadPoliticaHistorica`**: imperio, reino, estado o cultura que aparece en los snapshots históricos.
  - `nombre`: tal cual viene en historical-basemaps; identifica a la entidad en todos los años
  - `nombre_es`: opcional, sale de `backend/data/entidades_es.json`
- **`EntidadEpoca`**: cada entidad en cada año; lo calcula `cruzar_historia` desde la geometría de historical-basemaps (GPL), así que queda en la base y no en el repo.
  - `anio`, `entidad`: FK
  - `lon`, `lat`: dónde va su nombre en el mapa (centro visual de su parte más grande)
  - `area_km2`: decide desde qué zoom se rotula
  - `tono`: qué aguada del tema le toca, distinta de la de sus vecinas; cada entidad conserva su color de siempre salvo que choque con una vecina. Por eso cada tema tiene que tener al menos 10 aguadas.
- **`RegionEpoca`**: a qué entidad pertenecía cada región en cada año disponible.
  - `region`: FK
  - `anio`
  - `entidad`: FK a `EntidadPoliticaHistorica`
  - `porcentaje_superficie`: opcional, para regiones que caen entre dos entidades
- **`FichaRegion`**: texto en markdown escrito a mano sobre una región.
  - `region`: OneToOne, protegida: `cargar_regiones` no puede borrar una región con ficha
  - `texto`, `creada`, `actualizada`
- Las rutas históricas (Ruta de la Seda, Camino del Inca, la Campaña Libertadora) **no tienen modelo**: son logros definidos en código, con un objetivo por etapa.

## Fases

### Fase 1: el mapa que se pinta

1. Descargar **Natural Earth** en sus niveles admin-0 (países) y admin-1 (provincias). Simplificar las geometrías con **mapshaper** para que el navegador las maneje sin problemas.
   - **Las Islas del Atlántico Sur (Malvinas, Georgias del Sur y Sandwich del Sur) son territorio argentino en todos los niveles del mapa.** Natural Earth las trae como territorios británicos aparte (`FLK`, `SGS`). Al descargar, se integran al país `ARG` y a la provincia de Tierra del Fuego, Antártida e Islas del Atlántico Sur (`AR-V`), igual que en la capa del IGN.
   - No usar el archivo "punto de vista argentino" de Natural Earth (`ne_10m_admin_0_countries_arg`): tiene errores (le agrega Barbados a Uruguay) y cambia otras disputas ajenas al proyecto.
2. Escribir un management command que parsee esos GeoJSON y cargue las `Region`, con su jerarquía y el área precalculada.
3. Armar el mapa en MapLibre con colores por estado:
   - Gris: no visitado ("niebla de guerra").
   - Contorno o semitransparente: lista de deseos.
   - Color con intensidad según `tipo_presencia`: visitado.
4. Agregar zoom semántico: con zoom lejano se ven países y al acercarse aparecen las provincias, como el mapa de estados de Victoria 3.
   - Lentes, como los modos de mapa de Victoria 3: la automática es el zoom semántico; las de países, provincias y departamentos fijan el nivel con cualquier zoom. Cada lente es un par de umbrales de zoom (`UMBRALES` en `estilo.ts`) y cambiarla no recarga el mapa.
   - Mirando un año, la automática pasa antes a provincias: a nivel de país, cada país de hoy toma una sola entidad (Alemania en 1815 sería toda Prusia). Las fronteras internas de hoy se atenúan, para que manden los colores de las entidades.
   - El año, la lente y lo elegido viven en la URL (`url.ts`) y la posición en el hash (`vista.ts`): recargar o abrir un enlace vuelve a lo mismo. Elegir algo agrega una entrada al historial; mover el slider o cambiar la lente, no.
5. Sincronizar con Notion: un management command lee la base **Destinations** y crea viajes y deseos.
   - Propiedades de la base: `Name` (title), `Status` (status: Not started / Investigando / In progress / Done!), `Place` (place, con lat/lon), `Tags` (multi-select por continente, Argentina o Concert), `Lugares` (relación con la base Lugares).
   - La API pública sí expone `Place` con `lat`/`lon`. La base **Lugares** también tiene `Place` y un `Estado` (Visitado / Planeado), que es el que decide si una visita está realizada. "In progress" significa "planificando", no "viajando".
   - Orden para ubicar: `Place` de los Lugares → `Place` del destino → nombre contra las `Region` → **Nominatim**, aceptando solo resultados de tipo país, provincia o ciudad. Las coordenadas se traducen a región con point-in-polygon.
6. Al final de la fase, cargar el nivel departamento de Argentina con la capa **Departamento del IGN**, que trae el código INDEC (campo `in1`).
   - Los dos primeros dígitos del código INDEC identifican la provincia, y con eso se arma la jerarquía.
   - Se usa IGN y no GADM porque es la fuente oficial y su licencia permite redistribuir, así que se puede commitear el GeoJSON derivado. GADM prohíbe la redistribución.
   - Para otros países, evaluar la fuente caso por caso, revisando siempre la licencia antes de commitear datos derivados.

### Fase 2: el diario

1. CRUD de viajes y visitas desde el frontend, idealmente haciendo click en el mapa para marcar regiones.
   - El panel tiene cuatro pestañas: Viajes, Logros, Fichas y Números.
   - Un viaje elegido sigue resaltado mientras se mira otra pestaña o se lee una ficha: se deselecciona solo con "← Viajes". Una ficha se abre encima de lo que haya, con un enlace para volver.
2. Fotos: subida local. Si tienen GPS en el EXIF, se ubican solas en el mapa.
3. Estadísticas: países visitados, provincias argentinas, continentes y entidades históricas pisadas.
   - Las rutas de viaje (GPX, KML o dibujadas) y las cifras en km o km² se probaron y se sacaron: no aportaban.
4. Lo escrito a mano no se pierde:
   - Lo que no se guardó todavía (fichas, formularios de viaje) queda en el navegador: `hooks/useBorrador.ts`.
   - `manage.py respaldar` guarda viajes, visitas, fichas y fotos en un `.zip`.

### Fase 3: la historia

1. Descargar **historical-basemaps** (github.com/aourednik/historical-basemaps): GeoJSON del mundo en distintos años (1500, 1700, 1800, 1900, etc.).
2. Escribir un management command que cruce cada `Region` con cada snapshot y guarde el resultado en `EntidadPoliticaHistorica` y `RegionEpoca`.
   - Para regiones grandes, usar centroide o porcentaje de superficie, porque una región puede caer entre dos entidades.
3. Agregar un slider de años sobre mi mapa y un panel del tipo "en 1800 pisaste territorio de X entidades".
   - Junto al año va el nombre de la época ("1815 · Era de las revoluciones"), de la tabla editable `frontend/src/periodos.ts`.
   - El slider arranca en el cambio de era, con los años anteriores plegados (`paradas.ts`). El botón de reproducir recorre los años hasta el presente.
4. Fichas de región: texto en markdown escrito a mano al visitar cada lugar. No automatizarlo de entrada.
5. Rutas históricas y logros: se definen en código como conjuntos de regiones requeridas, y el progreso se calcula contra mis `Visita`.
   - Ejemplos de logros: "las 24 jurisdicciones argentinas", "todos los sucesores de la URSS", "las dos orillas del Bósforo".
   - Una ruta histórica es un logro con un objetivo por etapa: "La Campaña Libertadora" sigue a San Martín de Mendoza a Guayaquil.

**Ojo:** las fronteras de historical-basemaps son aproximadas y no cubren todos los años. Sirven para un diario personal, no como fuente académica.

## MVP de arranque

Un MVP de un fin de semana:

- Repo con Django y React/Vite levantados.
- Provincias argentinas de Natural Earth en el mapa.
- Salta, Jujuy y Tucumán pintadas como visitadas, desde un JSON hardcodeado. Todavía sin sincronizar con Notion.

Cuando eso se vea en pantalla, se suman las capas en el orden de las fases.

## Verificar

`python verificar.py` corre Ruff, el chequeo de migraciones, los tests de los dos lados, TypeScript, Oxlint, el build y un recorrido de la app en un Chrome sin ventana (`frontend/e2e/recorrido.mjs`), que solo mira y no guarda nada.
Antes de dar algo por terminado, tiene que pasar entero.

## Fuentes de datos

- **Natural Earth:** países y provincias. Dominio público.
- **IGN (Instituto Geográfico Nacional de Argentina):** departamentos, partidos y comunas, con código INDEC.
  - Se descarga por WFS desde la página Capas SIG.
  - Su licencia permite el uso y la redistribución gratuita con estas condiciones:
    - citar *"FUENTE: Instituto Geográfico Nacional de la República Argentina"*;
    - mencionar la fecha de los datos originales (geometría modificada por última vez el 11/11/2019);
    - no sugerir que el IGN avala el proyecto.
- **GADM:** descartado para los datos que se commitean. Su licencia es solo para uso no comercial y prohíbe redistribuir.
- **historical-basemaps:** fronteras históricas.
- **Nominatim:** geocodificación, si hace falta.
- **API de Notion:** base Destinations del Travel Planner.
