# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Un solo usuario: el dueño del proyecto, que viaja y planifica sus viajes en Notion.

- **Uso principal:** en la compu, en casa y con tiempo, después de un viaje: cargar visitas, marcar regiones en el mapa, subir fotos, escribir fichas y mirar cómo quedó el mapa.
- **Uso secundario:** en el celular, solo para leer: mirar el mapa o una ficha, muchas veces para mostrárselo a alguien. No se carga nada desde el celular ni durante el viaje.
- **A futuro:** quizás un perfil o enlace público algún día. Hoy no hay usuarios, deploy ni perfil público; nada de eso está decidido.

## Product Purpose

Periplo es el "después" de cada viaje: un mapa del mundo que se pinta a medida que viajo, un diario de viajes y una capa histórica que cruza lo que pisé con las entidades políticas de cada época.

Cruza tres intereses: los juegos de "pintar mapas" (grand strategy tipo Victoria 3), la historia y la geografía, y viajar.

El éxito es abrir el mapa y verlo pintado con lo vivido, y que lo escrito a mano (fichas, notas) no se pierda nunca.

## Positioning

El corazón es **el mapa que se pinta**: cuando haya que elegir entre capas, manda el mapa. El diario y la historia se leen desde el mapa, no al revés.

Lo que lo distingue de un mapa de "países visitados":

- Zoom semántico y lentes como los modos de mapa de Victoria 3 (países → provincias → departamentos argentinos).
- Niebla de guerra, deseos e intensidad según el tipo de presencia (estadía, de paso, tránsito).
- Un slider de años que repinta el mapa con las entidades históricas que ocupaban cada región ("en 1815 pisaste territorio de X entidades").
- Logros y rutas históricas definidos en código ("Las 24 jurisdicciones", "La Campaña Libertadora").

## Operating Context

- **Notion sigue siendo donde se planifica** (base Destinations dentro de Travel Planner, más la base Lugares). Periplo sincroniza desde ahí; no lo reemplaza.
- Corre local: Django + SQLite en el backend, React + Vite + MapLibre GL en el frontend.
- El estado de la vista (año, lente, pestaña, lo elegido, posición) vive en la URL: un enlace o una recarga vuelven a lo mismo.
- Panel lateral con cuatro pestañas: Viajes, Logros, Fichas y Números.
- `python verificar.py` es la puerta antes de dar algo por terminado, incluido un recorrido de la app en Chrome sin ventana.

## Capabilities and Constraints

- **Interfaz en castellano rioplatense** (`lang="es"`), incluidos los nombres traducidos de ~650 entidades históricas.
- **Todo color y toda fuente salen del tema** (`frontend/src/tema/`). Hay un registro de temas intercambiables; "Atlas de gabinete" es el de por defecto. Los tests fallan si aparece un color fuera del tema, y cada tema necesita al menos 10 aguadas para colorear entidades vecinas.
- **Las Islas del Atlántico Sur (Malvinas, Georgias del Sur y Sandwich del Sur) son territorio argentino** en todos los niveles del mapa.
- Las fronteras de historical-basemaps son aproximadas y no cubren todos los años: sirven para un diario personal, no como fuente académica.
- Las geometrías viven en GeoJSON simplificados, no en la base. Sin PostGIS ni GeoDjango.
- Se probaron y se sacaron: rutas de viaje (GPX, KML, dibujadas) y cifras en km o km². No volver a proponerlas sin motivo nuevo.
- Lo no guardado queda como borrador en el navegador; hay respaldos `.zip` automáticos.
- Abierto: si algún día hay un perfil público, qué se muestra y qué queda privado.

## Brand Commitments

- Nombre: **Periplo** (RAE: viaje o recorrido en el que se visitan varios lugares).
- Referencia explícita y vinculante: los modos de mapa de **Victoria 3** y los juegos de grand strategy (lentes, niebla de guerra, pintar territorio).
- Atribución obligatoria del IGN donde se usen sus datos: *"FUENTE: Instituto Geográfico Nacional de la República Argentina"*, con la fecha de los datos originales (11/11/2019) y sin sugerir que el IGN avala el proyecto.

## Evidence on Hand

- Datos reales: viajes y lugares sincronizados desde Notion; fotos propias en `backend/media/` (fuera del repo).
- Geometrías: Natural Earth (dominio público), departamentos del IGN (redistribuibles con cita), historical-basemaps (GPL: lo derivado queda en la base, no en el repo).
- Traducciones de entidades escritas a mano: `backend/data/entidades_es.json`.
- Logros definidos en `backend/mapa/logros.py`; períodos editables en `frontend/src/periodos.ts`.
- No hay testimonios, usuarios externos ni métricas de uso: no inventarlos.

## Product Principles

1. **El mapa manda.** Toda decisión se mide por cómo deja ver el mapa pintado; el panel acompaña y no lo tapa.
2. **Lo escrito a mano es sagrado.** Fichas, notas y visitas nunca se pierden por un error, un sync o un cambio de pantalla.
3. **Notion planifica, Periplo recuerda.** No duplicar la planificación; Periplo es el después.
4. **Jugar, no auditar.** Se cuenta lo que da placer (países, provincias, entidades, logros); las cifras que no aportan se sacan.
5. **Honesto con la historia.** Mostrar las épocas con orgullo pero sin fingir precisión académica.

## Accessibility & Inclusion

- En el celular basta con leer bien el mapa y las fichas; no hace falta cargar datos ahí.
- Si algún día se hace público, tiene que leerse para alguien que no conoce el proyecto.
