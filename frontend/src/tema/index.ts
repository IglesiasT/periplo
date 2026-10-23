import { atlas } from './atlas'
import type { Tema } from './tipos'

export type { Tema } from './tipos'

/** Los temas disponibles. Para sumar uno: un archivo nuevo en tema/ con un `Tema` completo, y una línea acá. */
export const TEMAS: Record<string, Tema> = {
  [atlas.id]: atlas,
}

export const TEMA_POR_DEFECTO = atlas

const enGuiones = (nombre: string) => nombre.replace(/[A-Z]/g, (letra) => `-${letra.toLowerCase()}`)

/** Las variables CSS del tema: `ui.papelHondo` → `--papel-hondo`, `fuentes.titulo` → `--titulo`. */
export function variablesCss(tema: Tema): Record<string, string> {
  const { texto, titulo, cursiva } = tema.fuentes
  return {
    ...Object.fromEntries(Object.entries(tema.ui).map(([nombre, valor]) => [`--${enGuiones(nombre)}`, valor])),
    '--texto': texto,
    '--titulo': titulo,
    '--cursiva': cursiva,
  }
}

/** Escribe el tema en el documento: sus variables CSS, su `color-scheme` y `data-tema` para CSS específico. */
export function aplicarTema(tema: Tema, raiz: HTMLElement = document.documentElement) {
  for (const [variable, valor] of Object.entries(variablesCss(tema))) raiz.style.setProperty(variable, valor)
  raiz.style.colorScheme = tema.esquema
  raiz.dataset.tema = tema.id
}
