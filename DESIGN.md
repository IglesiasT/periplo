---
name: Periplo
description: Mapa y diario de viajes personal, pintado como un atlas del siglo XIX coloreado a mano.
# Los valores de abajo son una copia de referencia del tema Atlas de gabinete.
# La fuente de verdad es frontend/src/tema/atlas.ts: si no coinciden, manda el código.
colors:
  papel: "#f3ebda"
  papel-hondo: "#e8dcc2"
  papel-claro: "#fbf7ee"
  borde: "#c9b48e"
  linea: "#dccbaa"
  tinta: "#2b2117"
  tenue: "#6b5a43"
  sepia: "#7c6a50"
  carmin: "#a8382c"
  carmin-oscuro: "#7e2a21"
  indigo: "#3e5c76"
  aguada: "#c6d4cc"
  tierra: "#eee4ce"
  ok: "#4f6b3a"
  frontera-provincia: "#bfae8c"
  rotulo-pais: "#4f4232"
  rotulo-provincia: "#3b2f22"
  rotulo-agua: "#4d6b63"
  aguada-ocre: "#ad8a3c"
  aguada-salvia: "#8ea26f"
  aguada-siena: "#b87459"
  aguada-pizarra: "#7896b3"
  aguada-malva: "#af89aa"
  aguada-verde-agua: "#628e87"
  aguada-tierra-de-sombra: "#b99378"
  aguada-rosa-viejo: "#986d74"
  aguada-oliva: "#7d8651"
  aguada-amarillo-paja: "#9d720a"
typography:
  display:
    fontFamily: "'IM Fell English SC', 'EB Garamond', Georgia, serif"
    fontSize: "38px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.04em"
  headline:
    fontFamily: "'IM Fell English SC', 'EB Garamond', Georgia, serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1.1
  title:
    fontFamily: "'IM Fell English SC', 'EB Garamond', Georgia, serif"
    fontSize: "18px"
    fontWeight: 400
    letterSpacing: "0.06em"
  body:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'IM Fell English SC', 'EB Garamond', Georgia, serif"
    fontSize: "13px"
    fontWeight: 400
    letterSpacing: "0.04em"
  acotacion:
    fontFamily: "'IM Fell English', 'EB Garamond', Georgia, serif"
    fontSize: "16px"
    fontWeight: 400
  cifra:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontSize: "54px"
    fontWeight: 500
    lineHeight: 1
    fontFeature: "'onum'"
rounded:
  none: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  panel: "28px 24px"
components:
  boton:
    backgroundColor: "transparent"
    textColor: "{colors.tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "6px 12px"
    height: "36px"
  boton-hover:
    backgroundColor: "{colors.papel-hondo}"
  boton-activo:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
  boton-peligro:
    textColor: "{colors.carmin}"
  enlace:
    textColor: "{colors.carmin-oscuro}"
    typography: "{typography.acotacion}"
    padding: "0"
  volver:
    textColor: "{colors.tenue}"
    typography: "{typography.acotacion}"
    padding: "0"
  campo:
    backgroundColor: "transparent"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "4px 2px"
  pestania:
    textColor: "{colors.tenue}"
    typography: "{typography.label}"
    height: "34px"
  pestania-activa:
    textColor: "{colors.tinta}"
  lente:
    textColor: "{colors.tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "1px 7px"
  lente-activa:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
  tarjeta-mapa:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
  panel:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    padding: "{spacing.panel}"
    width: "360px"
---

# Design System: Periplo

## Overview

**Creative North Star: "Atlas de gabinete"**

Periplo se ve como un atlas del siglo XIX coloreado a mano: papel crudo, tinta de grabador y aguadas. El mapa es la lámina y el panel lateral es el texto que la acompaña. La referencia de juego (los modos de mapa de Victoria 3) entra por la mecánica, con lentes, niebla y territorio que se pinta, y no por la estética de videojuego. Todo lo que el usuario toca parece impreso: filetes, versalitas, acotaciones en cursiva al margen.

La densidad es de libro, no de tablero. Hay pocos controles, separados por filetes finos y dobles en vez de cajas. El color está racionado: la tierra no visitada es papel, y el carmín se reserva para lo vivido. Así, abrir el mapa y verlo pintado es el momento que recompensa. Las épocas usan una paleta aparte, las diez aguadas, que nunca compite con el carmín de las visitas.

Periplo tiene **cinco temas intercambiables**: Atlas de gabinete (por defecto), Órbita, Consola, Cristal y Matriz. Este documento describe con valores el Atlas; los demás están resumidos en *Los otros temas*. Cada tema es un mundo propio: llena los mismos roles (ver *El contrato de temas* en Colors) y respeta las reglas marcadas como **invariantes**, pero el resto de las reglas de este documento son del Atlas y no se le imponen a los otros. Los valores pueden cambiar; los roles, no.

**Fuente de verdad.** Los hex, las fuentes y las medidas de este documento son una copia de referencia de `frontend/src/tema/atlas.ts` y de `index.css`. Si no coinciden, manda el código, y este documento se corrige.

**Key Characteristics:**
- Papel, tinta y aguadas; nada de blancos puros ni negros puros.
- Esquinas siempre rectas (0px) y bordes de 1px en tinta: piezas impresas, no tarjetas de app.
- Versalitas IM Fell para títulos y controles, EB Garamond para leer, cursiva IM Fell para las acotaciones.
- Plano: la profundidad son sombras duras desplazadas, sin difuminado.
- Carmín = lo vivido; índigo = lo deseado; aguadas = la historia.

## Colors

Una paleta de papel envejecido y tinta parda, con un solo acento cálido para lo vivido, un azul frío para lo deseado y diez aguadas apagadas para las épocas.

### El contrato de temas

Todo color sale del tema (`frontend/src/tema/`), nunca del CSS ni de los componentes. Cada clave de `ui` se convierte en una variable CSS (`papelHondo` → `--papel-hondo`). El mapa, que MapLibre pinta en canvas, recibe el tema en `crearEstilo(tema)`. Un tema nuevo es un archivo con un `Tema` completo y una línea en `TEMAS`. Los tests fallan si aparece un color fuera del tema.

Roles que todo tema llena (el tipo `Tema` en `tipos.ts`):

- `ui`: los colores del panel y los controles.
- `fuentes`: texto, título, cursiva, etiqueta, cifra y dos archivos de rótulos para el mapa.
- `mapa`: mar, tierra sin visitar, fronteras, resaltado, halo y rótulos.
- `estados`: visitada y deseo.
- **Al menos 10 aguadas** `[entintada, diluida]`.
- `forma`: tamaño base, radios, peso y caso de títulos y etiquetas, estilo de las aclaraciones, desenfoque del panel. Son variables CSS, igual que `ui`.
- `rasgos`: lo que cambia el layout o qué se dibuja: panel `fijo` o `flotante`, pestañas `filete`, `pastilla` o `caja`, sello `lacre` o `disco`, rosa de los vientos sí o no.
- `voz`: los textos que dependen de la personalidad del tema.

Los ornamentos que son solo de un tema van al final de `index.css`, bajo `:root[data-tema='…']`. Los tests también fallan si el texto no se lee sobre el papel o si lo visitado no se separa de la tierra.

### Los otros temas

Cada uno resuelve los mismos roles con otro mundo. Al trabajar en uno de ellos, sus decisiones mandan sobre las del Atlas: no hay que llevarlos hacia el papel, la serif ni las esquinas vivas.

| Tema | Mundo | Letra | Forma | Rasgos |
|---|---|---|---|---|
| **Órbita** | La Tierra de noche vista desde un satélite: lo visitado se enciende, lo demás queda a oscuras. | Geist Sans, etiquetas en mono | Radios de 14px, panel translúcido con desenfoque | Panel flotante, pestañas en pastilla, sello disco, sin rosa |
| **Consola** | Una sala de control: grafito, una señal verde lima, retícula. | JetBrains Mono en todo | Radios de 2px, sin desenfoque | Panel fijo, pestañas en caja, sello disco, sin rosa |
| **Cristal** | Un mapa claro de app actual, con el panel esmerilado flotando encima. | Figtree en todo | Radios de 20px, marcas redondas, desenfoque fuerte | Panel flotante, pestañas en pastilla, sello disco, sin rosa |
| **Matriz** | Blanco, negro y un solo rojo, con títulos y cifras en matriz de puntos. | Doto para títulos y cifras, Geist Sans para leer, Geist Mono para etiquetas | Paneles rectos, controles en pastilla, marcas redondas | Panel fijo, pestañas en pastilla, sello disco, sin rosa |

Los valores exactos de cada uno están en su archivo de `frontend/src/tema/`.

### Primary
- **Carmín de lacre** (`carmin`): lo vivido. Es el relleno de lo visitado en el mapa, la marca de un viaje hecho, la barra de avance, el lacre de los sellos de logros, la punta norte de la rosa de los vientos y el anillo de foco. Tiene una variante **Carmín seco** (`carmin-oscuro`) para texto sobre papel: enlaces, el año de la época, errores.

### Secondary
- **Índigo de plan** (`indigo`): el deseo. En el mapa y en la lista va **solo como contorno** (1.2px en el mapa, 1.5px en la marca de la lista) y nunca como relleno.

### Tertiary
- **Las diez aguadas** (`aguada-ocre` … `aguada-amarillo-paja`): las entidades históricas de cada época, cada una con su par diluido. Son de familias de color distintas a propósito, para que dos vecinas nunca se confundan, y ninguna es un rojo puro, para no confundirse con el carmín.

Cada tema saca sus aguadas de su propio mundo, no de una rueda de colores común: pigmentos apagados en el Atlas, luces sobre la noche en Órbita, fósforos sobre grafito en Consola, tonos suaves en Cristal y grises teñidos en Matriz. *(Invariante entre temas, y los tests lo controlan:)* ninguna entintada se acerca a lo visitado ni al deseo (ΔE OKLab ≥ 0,10), lo pisado se separa de lo no pisado de la misma entidad (contraste ≥ 1,9 en temas claros y ≥ 3,5 en oscuros), la diluida se separa de la tierra (ΔE ≥ 0,04) y dos aguadas vecinas no se confunden (ΔE ≥ 0,04 entre entintadas y ≥ 0,02 entre diluidas).

### Neutral
- **Papel crudo** (`papel`): fondo del panel, de las tarjetas sobre el mapa y de los popups. Es el color del documento.
- **Papel hondo** (`papel-hondo`): hover de botones y fondo de avisos.
- **Papel claro** (`papel-claro`): el paspartú de las fotos.
- **Tierra sin pintar** (`tierra`): la tierra no visitada en el mapa. Es la "niebla de guerra" del atlas.
- **Aguada de mar** (`aguada`): el mar y la pantalla de carga.
- **Tinta de grabador** (`tinta`): texto, bordes de controles, botón activo, trazo del resaltado.
- **Tinta tenue** (`tenue`): texto secundario, pestañas inactivas, rótulos de campos.
- **Sepia** (`sepia`): fronteras de país, filetes dobles, acotaciones de origen ("· Notion").
- **Borde** y **línea** (`borde`, `linea`): filetes del panel, de mayor a menor peso.
- **Verde de confirmación** (`ok`): solo para mensajes de "guardado".

### Named Rules
**The Lacre Rule.** El carmín significa "estuve ahí". No se usa para decorar ni para llamar la atención sobre algo que no sea lo vivido, salvo el foco de teclado y los errores (en carmín seco).

**The Deseo Hueco Rule.** Un deseo nunca se rellena: es tierra sin pintar con contorno índigo, en el mapa, en la leyenda y en la lista. *(Invariante entre temas.)*

**The Two Palettes Rule.** Las visitas y las épocas no comparten paleta. Mirando un año mandan las aguadas, y las fronteras internas de hoy se atenúan.

## Typography

**Display Font:** IM Fell English SC (con EB Garamond y Georgia como respaldo)
**Body Font:** EB Garamond (con Georgia)
**Acotación:** IM Fell English en cursiva (con EB Garamond)

**Character:** Versalitas de imprenta antigua para todo lo que se nombra o se toca, y una Garamond de libro para lo que se lee. La cursiva Fell hace de nota al margen: es la voz del cartógrafo. Las fuentes se sirven desde `node_modules` (@fontsource), sin pedirle nada a Google, y el mapa rasteriza sus propios archivos de versalitas y cursiva.

### Hierarchy
- **Display** (400, 38px, 1, 0.04em): el título "Periplo" en la cabecera del panel.
- **Headline** (400, 28px, 1.1): el nombre de lo abierto, sea un viaje, una ficha o un logro.
- **Title** (400, 18px, 0.06em): secciones dentro del panel; también los títulos dentro de una ficha (19px) y el nombre en un popup.
- **Body** (400, 16px, 1.5 en fichas): texto corrido, filas de listas y campos. Los nombres en las listas van a 18px y peso 500.
- **Label** (400, 13–15px, 0.04–0.08em, versalitas): botones (15px), pestañas (14px), rótulos de campo (14px), lentes y etiquetas de cifras (13px).
- **Acotación** (cursiva, 13–16px): lemas, "← volver", enlaces, estados vacíos, el nombre de la época, la fuente de los datos.
- **Cifra** (500, 54px, numerales de estilo antiguo): la cifra grande de países. Las cifras chicas van a 19px, y los años siempre con `oldstyle-nums`.

### Named Rules
**The Versalitas Rule.** Lo que se nombra o se toca (títulos, botones, pestañas, rótulos) va en versalitas Fell con espaciado positivo. El texto corrido nunca va en versalitas.

**The Old-Style Numerals Rule.** Las cifras y los años usan numerales de estilo antiguo, como en un libro impreso.

**Rótulos del mapa.** Los países y las provincias van en versalitas, con espaciado proporcional al área. El agua va en cursiva, en `rotulo-agua`. Todos los rótulos llevan un halo de papel al 85% (`velo`, 1.6px).

## Layout

La pantalla es una lámina con su texto: un **panel fijo de 360px a la izquierda** (padding 28px × 24px, scroll propio, filete derecho en `borde`) y el **mapa ocupando el resto**. Sobre el mapa flotan pocas piezas, cada una en un lugar fijo:

- **Controles de época y lentes:** una tarjeta centrada arriba, de `min(420px, 100% − 140px)` de ancho.
- **Leyenda o panel de entidades de la época:** abajo a la izquierda, a 16px de los bordes. El panel de entidades mide hasta 320px de ancho, ocupa como máximo el 45% del alto y tiene scroll propio.
- **Rosa de los vientos:** abajo a la derecha, decorativa, sin eventos.
- **Controles de zoom de MapLibre:** recuadrados en tinta.

El ritmo sale de una escala corta de 4px (4 · 8 · 12 · 16 · 24). Las secciones del panel se separan con 26px arriba y 8px abajo; las filas de lista, con filetes de 1px en `linea` y 8–10px de aire. Las pestañas (Viajes · Logros · Fichas · Números) ocupan todo el ancho, en partes iguales.

**Responsive:** todavía no hay adaptación a pantallas chicas. El celular de lectura (mapa y fichas) es un uso confirmado que este layout aún no resuelve.

## Elevation & Depth

Es un sistema plano, como el papel. No hay sombras difuminadas. La profundidad se marca de tres maneras: con bordes de 1px en tinta alrededor de lo que flota sobre el mapa, con el cambio de tono entre `papel` y `papel-hondo`, y con **sombras duras desplazadas** que imitan una lámina montada sobre otra.

### Shadow Vocabulary
- **Lámina montada** (`box-shadow: 3px 3px 0 var(--sombra)`): popups del mapa.
- **Copia pegada** (`box-shadow: 2px 2px 0 var(--linea)`): las fotos, con paspartú de 4px en `papel-claro` y borde en `borde`.
- **Halo de papel** (en el mapa, `line-width` 6, `blur` 1.5, `opacity` 0.85): pasa por debajo del trazo de 2px en tinta del resaltado, para que lo elegido se lea sobre cualquier relleno.

### Named Rules
**The Hard Shadow Rule.** Si algo necesita despegarse del papel, se desplaza con sombra dura de 2–3px y 0 de difuminado. Nunca una sombra suave ni un `backdrop-filter`.

## Shapes

Todo es rectángulo de esquinas vivas (`border-radius: 0`), incluidos los controles de MapLibre, que se sobrescriben. La forma la dan los filetes:

- **Filete doble** (`3px double` sepia): abre las pestañas y el bloque de estadísticas, como el encabezado de una sección de atlas.
- **Filete simple** de 1px, en `borde` para los marcos y en `linea` para separar filas.
- **Subrayado como campo:** los inputs son una línea de tinta de 1px abajo. El textarea es la excepción: lleva un recuadro en `borde` sobre `campo`.

Las únicas formas curvas son los ornamentos de atlas: la rosa de los vientos, los sellos de lacre de los logros (un anillo con estrella y un arco de avance en carmín) y los círculos de las fotos en el mapa.

## Components

### Buttons
Tinta sobre papel, en versalitas. Se leen como cajetines impresos.
- **Shape:** rectángulo de esquinas vivas (0px), borde de 1px en tinta, alto mínimo de 36px.
- **Por defecto:** fondo transparente, versalitas a 15px con 0.05em de espaciado.
- **Hover:** fondo `papel-hondo`.
- **Activo / submit:** se entinta (fondo `tinta`, texto `papel`).
- **Peligro:** borde y texto en carmín, empujado al final de la fila de acciones.
- **Deshabilitado:** opacidad 0.5.
- **Botones-texto** (`volver`, `enlace`): sin borde ni fondo, en cursiva Fell de 16px. "Volver" va en `tenue` y el enlace en `carmin-oscuro`; ambos pasan a tinta con hover.

### Navigation: pestañas
- Una fila de versalitas de 14px debajo de un filete doble sepia, en cuatro partes iguales.
- **Inactiva:** en `tenue`. **Activa:** en tinta, con una raya de 2px abajo.
- **Foco:** contorno de 2px en carmín, hacia adentro.

### Lentes (signature)
Son radios de verdad: se recorren con las flechas y los lectores de pantalla los anuncian. Tienen aspecto de pequeños cajetines.
- Versalitas de 13px, borde de 1px en `borde` y padding de 1px × 7px.
- **Hover:** el borde pasa a tinta. **Activa:** se entinta. **Foco:** contorno de 2px en carmín.

### Selector de época (signature)
Una tarjeta en tinta sobre papel, arriba y al centro del mapa:
- **Cabecera:** el rótulo "Época" en versalitas y el año en versalitas de 22px y `carmin-oscuro`. El nombre del período va en cursiva, alineado a la derecha.
- **Mandos:** botones cuadrados de 26px (reproducir, ‹, ›) y un slider con `accent-color` carmín.
- **Plegado:** el "antes" se pliega con un enlace en cursiva subrayado.

### Inputs / Fields
- **Estilo:** solo una línea de tinta de 1px abajo, fondo transparente y Garamond de 16px. El rótulo va arriba, en versalitas de 14px y `tenue`.
- **Textarea:** recuadro de 1px en `borde`, fondo `campo` (blanco al 35%) y texto en cursiva.
- **Deshabilitado:** lo que manda Notion se lee como texto impreso. Pierde la línea y la flecha del select, y conserva la opacidad completa.
- **Error:** texto de 14px en `carmin-oscuro`. **Guardado:** cursiva de 14px en `ok`.

### Tarjetas sobre el mapa
La leyenda, el panel de época, el selector y los popups comparten el mismo marco: papel, borde de 1px en tinta, 0px de radio y padding de 12px × 16px. Los popups suman la sombra de lámina montada y no muestran la flecha.

### Listas
Las filas de viajes, visitas, logros y entidades se separan con filetes de 1px en `linea`. Cada viaje lleva una **marca** de 13px: relleno carmín si ya fui, contorno índigo si es un plan, igual que en el mapa. Los objetivos de un logro son cuadraditos de 8px que se rellenan de carmín al cumplirse.

### Sellos de logros (signature)
Son lacres SVG: un disco carmín con anillo y estrella de papel cuando el logro está cumplido, y un arco de avance carmín sobre una pista en `linea` mientras está en curso.

### Cifras
La cifra de países va a 54px y peso 500, con numerales antiguos y una acotación en cursiva al lado. Debajo van tres cifras chicas en grilla y barras de 3px (pista en `linea`, avance en carmín).

## Do's and Don'ts

Las reglas sobre el tema, los deseos y el mapa valen para todos los temas. Las de forma (esquinas, sombras, desenfoque, blanco y negro puros, el uso del carmín) son del Atlas: cada tema define las suyas en su archivo.

### Do:
- **Do** sacar cada color y cada fuente del tema activo: `var(--papel)` en el CSS, `tema.mapa.*` en el estilo del mapa.
- **Do** dar a cada tema nuevo los roles completos de `Tema`, con al menos 10 aguadas sacadas de su propio mundo, que no se parezcan al color de lo visitado ni al del deseo.
- **Do** separar con filetes (1px, o 3px dobles para abrir una sección) en vez de cajas o fondos.
- **Do** escribir las notas, los estados vacíos y los vínculos de vuelta en cursiva Fell, como acotaciones al margen.
- **Do** mantener el foco de teclado visible con un contorno de 2px en carmín.
- **Do** llevar la gramática del mapa a todo lo que lo representa: la marca de la lista y la leyenda repiten exactamente el relleno o el contorno del mapa.

### Don't:
- **Don't** escribir un hex, un `rgb()` o un nombre de fuente en el CSS o en un componente; los tests lo rechazan.
- **Don't** redondear esquinas ni usar sombras difuminadas, vidrio esmerilado o gradientes.
- **Don't** rellenar un deseo, ni rayarlo: es solo un contorno índigo.
- **Don't** usar el carmín para algo que no sea lo vivido, el foco o un error.
- **Don't** usar blanco puro ni negro puro; el papel y la tinta son siempre cálidos.
- **Don't** tapar el mapa: el panel queda al costado y las tarjetas flotantes son chicas y van en las esquinas o arriba al centro.
