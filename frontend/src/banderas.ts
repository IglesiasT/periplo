import { BANDERAS } from './banderasDisponibles'

/** La bandera de un país por su código en el mapa (ARG); null si no tiene (Somalilandia, Bir Tawil…). */
export function urlBandera(codigo: string | undefined): string | null {
  return codigo !== undefined && BANDERAS.has(codigo) ? `/banderas/${codigo}.svg` : null
}

/** El país de una región, de una lista que va de ella hacia arriba: el primero que tenga bandera.
 *  Para un país es él mismo; para una provincia o un departamento, el país que la contiene. */
export function paisConBandera(codigos: (string | undefined)[]): string | undefined {
  return codigos.find((codigo) => codigo !== undefined && BANDERAS.has(codigo))
}
