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

// Hash de texto estable (FNV-1a): el color de siempre de una entidad, si la API no manda su tono.
// El backend usa el mismo (historia.hash_nombre) como preferencia al repartir los tonos.
function hash(texto: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Color de la entidad: el propio si lo tiene, o la aguada de su tono (distinta de la de sus vecinas).
 *  `intenso` es la entintada (lo que pisé); si no, la diluida. */
export function colorEntidad(entidad: string, epoca: Epoca, intenso: boolean, aguadas: Tema['aguadas']): string {
  const propio = epoca.colores[entidad]
  if (propio) return propio
  const tono = epoca.tonos[entidad] ?? hash(entidad)
  const [entintada, diluida] = aguadas[tono % aguadas.length]
  return intenso ? entintada : diluida
}
