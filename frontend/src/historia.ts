import type { Epoca } from './types'

/** 1800 → "1800", -500 → "500 a. C.". */
export function formatearAnio(anio: number): string {
  return anio < 0 ? `${-anio} a. C.` : String(anio)
}

// Hash de texto estable (FNV-1a): la misma entidad tiene el mismo tono en todos los años.
function hash(texto: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// Las aguadas de un atlas coloreado a mano: [entintada, diluida]. Las entintadas son lo que pisé.
// Sin rojos puros, para no confundirse con el carmín de las visitas del presente.
const AGUADAS: [string, string][] = [
  ['#c49a4a', '#e6d3a8'], // ocre
  ['#8a9a5b', '#cfd6b4'], // salvia
  ['#b9714f', '#e3c2ae'], // siena
  ['#6f8aa1', '#c4d0da'], // pizarra
  ['#a07a9a', '#dccbd8'], // malva
  ['#7f9c8c', '#c9d8cf'], // verde agua
  ['#9c7b56', '#d9c7b0'], // tierra de sombra
  ['#b58f8a', '#e4d0cc'], // rosa viejo
  ['#8c8f6a', '#d1d2bb'], // oliva
  ['#c0a35c', '#e8dcb5'], // mostaza
]

/** Tono de la entidad: su color propio si lo tiene, o una aguada elegida por su nombre. */
export function colorEntidad(entidad: string, epoca: Epoca, intenso: boolean): string {
  const propio = epoca.colores[entidad]
  if (propio) return propio
  const [entintada, diluida] = AGUADAS[hash(entidad) % AGUADAS.length]
  return intenso ? entintada : diluida
}
