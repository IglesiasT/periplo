import type { Visita } from './types'

/**
 * Cómo se resalta una región en el mapa:
 * - `directa`: la elegida (una visita del viaje, una etapa del logro, la región de la ficha). Se ve en cualquier zoom.
 * - `contiene`: el país o la provincia que contiene a una elegida. Se ve solo a zoom bajo, mientras la elegida
 *   todavía es demasiado chica para distinguirse: un viaje a Tilcara marca Argentina de lejos y Tilcara de cerca.
 */
export type Resaltado = 'directa' | 'contiene'

/** Código de región → cómo se resalta. Las que no están no se resaltan. */
export type Resaltadas = Map<string, Resaltado>

export function resaltarRegiones(codigos: Iterable<string>): Resaltadas {
  return new Map([...codigos].map((codigo) => [codigo, 'directa']))
}

export function resaltarViaje(visitas: Pick<Visita, 'region' | 'region_ancestros'>[]): Resaltadas {
  const resaltadas: Resaltadas = new Map()
  for (const visita of visitas) {
    for (const ancestro of visita.region_ancestros) resaltadas.set(ancestro, 'contiene')
  }
  // Después, para que una región visitada que además contiene a otra (Jujuy y Tilcara) quede como directa.
  for (const visita of visitas) resaltadas.set(visita.region, 'directa')
  return resaltadas
}

/** A qué regiones acercar el mapa: solo a las elegidas. Un viaje a Jujuy acerca a Jujuy, no a toda Argentina. */
export function regionesAEncuadrar(resaltadas: Resaltadas): string[] {
  return [...resaltadas].filter(([, resaltado]) => resaltado === 'directa').map(([codigo]) => codigo)
}
