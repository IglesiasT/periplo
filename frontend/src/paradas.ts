/** Una parada del slider: un año con snapshot, o null para el presente. */
export type Parada = number | null

// El slider arranca en el cambio de era. No hay snapshot del 1 d. C.: el más cercano es el del 1 a. C., y el siguiente
// recién el del 100. Los anteriores (hasta el 123000 a. C.) van plegados: son la mitad de las paradas para un mapa
// casi siempre sin nada pisado.
export const PRIMER_ANIO_A_LA_VISTA = -1

/** `anios` de menor a mayor. La última parada es siempre el presente. */
export function paradasDe(anios: number[], conAntiguos: boolean): Parada[] {
  return [...(conAntiguos ? anios : anios.filter((anio) => anio >= PRIMER_ANIO_A_LA_VISTA)), null]
}

/** Un año plegado que ya está elegido (un enlace, por ejemplo) tiene que seguir en el slider. */
export const esAntiguo = (parada: Parada) => parada !== null && parada < PRIMER_ANIO_A_LA_VISTA

/** undefined si no hay nada después: se está en el presente. */
export function paradaSiguiente(paradas: Parada[], actual: Parada): Parada | undefined {
  return paradas[paradas.indexOf(actual) + 1]
}

/** undefined si no hay nada antes: se está en la primera. */
export function paradaAnterior(paradas: Parada[], actual: Parada): Parada | undefined {
  return paradas[paradas.indexOf(actual) - 1]
}
