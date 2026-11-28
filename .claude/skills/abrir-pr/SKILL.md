---
name: abrir-pr
description: Abre un pull request de Periplo con las convenciones del proyecto - verificar.py entero, revisar que no entren secretos ni datos que no se pueden redistribuir, commit en español, PR asignado a IglesiasT con labels y la descripción en el formato de siempre. Usar cuando el usuario pide "abrí un PR", "subilo", "mandalo a GitHub", "hacé el PR" o "commiteá y pusheá".
---

# Abrir un PR en Periplo

Solo cuando el usuario lo pide: no commitear ni pushear por iniciativa propia. Nunca mergear el PR.

## 1. Verificar

Correr `python verificar.py` desde la raíz (en segundo plano: tarda, porque incluye el build y el recorrido en Chrome sin ventana). Tiene que pasar entero. Si algo falla, arreglarlo o contarle al usuario qué falla y frenar: no se abre un PR rojo.

## 2. Revisar lo que entra

Mirar `git status` y el diff completo (`git diff` y `git diff --staged`) antes de commitear. No puede entrar:

- **secretos**: `backend/.env`, tokens de Notion, `SECRET_KEY`, claves de API. Van en `backend/.env`, con `.env.example` como plantilla;
- **geometría de historical-basemaps** (GPL): lo que calcula `cruzar_historia` vive en la base, no en el repo;
- **datos de GADM**: su licencia prohíbe redistribuir;
- `backend/data/raw/`, `media/`, `backend/respaldos/`, `db.sqlite3`.

Los GeoJSON derivados de Natural Earth y del IGN sí se commitean. Si aparece algo dudoso, preguntar antes de seguir.

Agregar los archivos por nombre (`git add <rutas>`), no `git add -A`.

## 3. Rama y commit

- La rama se llama `<tipo>/<tema-corto>`, con el mismo tipo que el commit (`feat/`, `fix/`, `docs/`, `test/`, `refactor/`, `chore/`). **Nunca `claude/`.** Si se está en `main`, crearla antes; si la app la creó como `claude/…`, renombrarla (`git branch -m <tipo>/<tema-corto>`) antes de pushear. Si ya está pusheada o tiene PR, preguntar antes de renombrar.
- Mensaje en español, con prefijo convencional: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`. Ejemplos del historial: `feat: Mi periplo, la repetición del mapa viaje por viaje`, `fix: colores de época propios de cada tema`.
- Terminar el mensaje con la línea `Co-Authored-By` que indique el sistema para esta sesión.

## 4. El PR

```powershell
git push -u origin <rama>
gh pr create --title "<título>" --body-file <archivo> --assignee IglesiasT --label <label> --label <label>
```

- **Título**: en español, corto, dice lo que hace la app ("Banderas de los países y color de cada entidad en la ficha"). Puede llevar el prefijo del commit.
- **Asignado siempre a `IglesiasT`.**
- **Labels**: una o más de las del repo (`gh label list`). Las que se usan:
  - `enhancement` (algo nuevo), `bug` (un arreglo), `documentation`;
  - `tests` (tests nuevos o cambiados), `temas` (colores, fuentes y forma), `mapa` (lo que se ve y se pinta en el mapa).
  - Si ninguna describe un área del PR, crear una con `gh label create <nombre> --description "<en español>" --color <hex>` y avisarle al usuario cuál se creó y por qué.

### Descripción

Escribir el cuerpo en un archivo temporal del scratchpad y pasarlo con `--body-file`. En español, contando lo que hace la app, sin nombrar fases ni rondas internas. Secciones:

```markdown
## Qué hace

Lo que cambia para quien usa la app, en uno o dos párrafos o una lista corta.

## Cómo está hecho

Los archivos y decisiones que importan para revisarlo, con las rutas en `código`.

## Verificación

- `python verificar.py` pasa entero (y qué tests o pasos del recorrido se sumaron).
- Qué se probó a mano y con qué temas o datos.
- Lo que **no** se pudo probar, dicho explícitamente.

## Pendiente, para más adelante

Solo si quedó algo; si no, la sección no va.
```

Terminar el cuerpo con la línea de atribución que indique el sistema para los PRs.

## 5. Después

Pasarle al usuario el enlace del PR, las labels que lleva (y si se creó alguna) y lo que quedó sin verificar.
