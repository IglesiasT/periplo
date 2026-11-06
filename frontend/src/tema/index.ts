import { atlas } from './atlas'
import { consola } from './consola'
import { cristal } from './cristal'
import { matriz } from './matriz'
import { orbita } from './orbita'
import type { Tema } from './tipos'

export type { Tema } from './tipos'

/** Los temas disponibles. Para sumar uno: un archivo nuevo en tema/ con un `Tema` completo, y una línea acá. */
export const TEMAS: Record<string, Tema> = {
  [atlas.id]: atlas,
  [orbita.id]: orbita,
  [consola.id]: consola,
  [cristal.id]: cristal,
  [matriz.id]: matriz,
}

export const TEMA_POR_DEFECTO = atlas

const enGuiones = (nombre: string) => nombre.replace(/[A-Z]/g, (letra) => `-${letra.toLowerCase()}`)

/** Las variables CSS del tema: `ui.papelHondo` → `--papel-hondo`, `forma.radio` → `--radio`, `fuentes.titulo` → `--titulo`. */
export function variablesCss(tema: Tema): Record<string, string> {
  const { texto, titulo, cursiva, etiqueta, cifra } = tema.fuentes
  return {
    ...Object.fromEntries(
      Object.entries({ ...tema.ui, ...tema.forma }).map(([nombre, valor]) => [`--${enGuiones(nombre)}`, valor]),
    ),
    '--texto': texto,
    '--titulo': titulo,
    '--cursiva': cursiva,
    '--etiqueta': etiqueta,
    '--fuente-cifra': cifra,
  }
}

/** Escribe el tema en el documento: sus variables CSS, su `color-scheme` y los `data-*` para el CSS que depende
 *  del tema, del panel flotante o de la forma de las pestañas. */
export function aplicarTema(tema: Tema, raiz: HTMLElement = document.documentElement) {
  for (const [variable, valor] of Object.entries(variablesCss(tema))) raiz.style.setProperty(variable, valor)
  raiz.style.colorScheme = tema.esquema
  raiz.dataset.tema = tema.id
  raiz.dataset.panel = tema.rasgos.panel
  raiz.dataset.pestanias = tema.rasgos.pestanias
}
