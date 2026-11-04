import type { Tema } from './tema'
import type { Epoca } from './types'

/** 1800 → "1800", -500 → "500 a. C.". */
export function formatearAnio(anio: number): string {
  return anio < 0 ? `${-anio} a. C.` : String(anio)
}

/** Nombre para mostrar: en castellano si está traducido, si no tal cual viene en historical-basemaps. */
export function nombreEntidad(entidad: string, epoca: Epoca): string {
  return epoca.nombres[entidad] ?? entidad
}

/** Color de la entidad: la aguada de su tono, distinta de la de sus vecinas (lo reparte cruzar_historia).
 *  `intenso` es la entintada (lo que pisé); si no, la diluida. */
export function colorEntidad(entidad: string, epoca: Epoca, intenso: boolean, aguadas: Tema['aguadas']): string {
  const [entintada, diluida] = aguadas[(epoca.tonos[entidad] ?? 0) % aguadas.length]
  return intenso ? entintada : diluida
}
