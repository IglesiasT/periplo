---
name: sumar-tema
description: Suma un tema visual nuevo a Periplo (colores, fuentes, forma, rasgos y voz) o rehace uno existente, siguiendo el contrato de frontend/src/tema/ y los tests de contraste. Usar cuando el usuario pide "un tema nuevo", "otro look", "agregá el tema X", "rehacé el tema Y" o quiere cambiar la paleta entera de uno.
---

# Sumar un tema a Periplo

Un tema es un objeto `Tema` completo (`frontend/src/tema/tipos.ts`). Todo color y toda fuente de la app sale de ahí: el CSS lee variables (`var(--papel)`) y el mapa se arma con `crearEstilo(tema)`. Nunca escribir colores en el CSS, en los componentes ni en `src/lamina/`: los tests fallan.

## 1. Plan antes de codear

Antes de escribir el archivo, mostrarle al usuario una propuesta corta y esperar su OK:

- **Mundo**: una frase, como las de la tabla "Los otros temas" en `DESIGN.md` ("Una sala de control: grafito, una señal verde lima, retícula").
- **Esquema**: `light` o `dark`.
- **Paleta base**: papel, tinta, acento (lo visitado), deseo, hogar, tierra sin visitar, mar.
- **Letra**: familias para texto, títulos, etiquetas y cifras, y cuáles hay que instalar.
- **Forma y rasgos**: panel `fijo` o `flotante`, pestañas `filete` / `pastilla` / `caja`, sello `lacre` / `disco`, rosa sí o no, lámina `cartela` o `hud`.

Un tema nuevo resuelve los mismos roles con su propio mundo: no copiar el Atlas cambiando colores, ni llevarlo hacia el papel o la serif.

## 2. El archivo del tema

Crear `frontend/src/tema/<id>.ts` tomando como molde el tema existente más parecido (`matriz.ts` o `consola.ts` para uno claro u oscuro sobrio, `orbita.ts` o `cristal.ts` para panel flotante con desenfoque). Leerlo entero antes.

- Comentario de una línea arriba con el mundo del tema.
- **Fuentes** con `@fontsource/<familia>`: `npm install` en `frontend/`, importar los pesos que se usan, y para `fuentes.mapa` importar los `.woff2` con `?url` (MapLibre los rasteriza, no hay servidor de glyphs).
- Colores como constantes arriba del objeto cuando se repiten (`papel`, `tinta`, `mar`, `tierra`).
- Completar **todas** las claves de `ui`, `fuentes`, `forma`, `rasgos`, `voz`, `mapa`, `estados` y `aguadas`. TypeScript avisa si falta alguna.
- `forma.filtroIconos`: `invert(1)` si el tema es oscuro.
- `forma.filtroBandera`: el filtro que envejece o apaga las banderas según el mundo (sepia en Atlas, gris en Consola y Matriz).
- `voz`: `lema`, `cargando`, `completos` ("1 de 13 sellados"), `completo` y `tituloLamina`, en la voz del tema.

### Las aguadas

Al menos **10** pares `[entintada, diluida]` (el backend reparte `historia.CANTIDAD_TONOS` tonos entre vecinas). Sacarlas del mundo del tema, no de una rueda común. Los tests exigen:

- ninguna entintada a menos de ΔE OKLab 0,10 de `estados.visitada` ni de `estados.deseo`;
- contraste entintada/diluida ≥ 1,9 en temas claros y ≥ 3,5 en oscuros;
- cada diluida a ΔE ≥ 0,04 de `mapa.noVisitado`;
- entre entintadas ΔE ≥ 0,04, y entre diluidas ≥ 0,02.

### Contraste que controla `tema.test.ts`

- `tinta`, `tenue` y `carminOscuro` sobre `papel` ≥ 4,5; `tenue` sobre `papelHondo` ≥ 4,5; `activoTexto` sobre `activo` ≥ 4,5.
- `estados.visitada`, `hogar` y `deseo` contra `mapa.noVisitado` ≥ 3.
- `hogar` a ΔE ≥ 0,15 de `visitada`.

Los colores que miden los tests tienen que ser `#rrggbb`: las funciones de contraste no entienden `rgba()` ni hex cortos.

## 3. Registrarlo

- Una línea en `TEMAS` de `frontend/src/tema/index.ts` (y su import). Los puntos del pie del panel salen solos de `TEMAS`.
- No cambiar `TEMA_POR_DEFECTO` salvo que el usuario lo pida: el Atlas es el de por defecto y un test lo controla.

## 4. Ornamentos propios (opcional)

Lo que es solo de este tema va **al final** de `frontend/src/index.css`, bajo `:root[data-tema='<id>'] …`, después de los bloques de los otros temas. Solo variables del tema, nunca colores literales.

## 5. Documentarlo

- `DESIGN.md`: una fila en la tabla "Los otros temas" (Mundo, Letra, Forma, Rasgos).
- `CLAUDE.md`: sumar el nombre a la lista "Temas:" del Stack, y el filtro de banderas si es nuevo.

## 6. Verificar

1. `npx vitest run src/tema` en `frontend/` mientras se ajustan los colores: los mensajes dicen qué par falla.
2. Mirar el tema en la app (`preview_start` con la configuración de `.claude/launch.json`): elegirlo con los puntos del pie, recorrer Viajes, Logros, Fichas y Números, el slider en un año con épocas (1815), una ficha con bandera y la lámina de Exportar. Probar a ancho de teléfono si el panel es flotante.
3. `python verificar.py` tiene que pasar entero antes de darlo por terminado.

Cerrar con un resumen y capturas, y esperar el OK del usuario. No commitear sin que lo pida.
