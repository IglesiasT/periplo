import type { Logro, Visita } from './types'

/**
 * Cómo se resalta una región en el mapa:
 * - `directa`: la elegida (una visita del viaje, la región de la ficha, un país de un logro). Se ve en cualquier zoom.
 * - `contiene`: el país o la provincia que contiene a una elegida. Se ve solo a zoom bajo, mientras la elegida
 *   todavía es demasiado chica para distinguirse: un viaje a Tilcara marca Argentina de lejos y Tilcara de cerca.
 * - `nivel`: una provincia de un logro. Se ve desde que el mapa muestra provincias; antes se ve su país (`contiene`).
 *   Así un logro sigue la lente: el Imperio romano son países con la de países y provincias con la de provincias.
 */
export type Resaltado = 'directa' | 'contiene' | 'nivel'

/** Código de región → cómo se resalta. Las que no están no se resaltan. */
export type Resaltadas = Map<string, Resaltado>

export function resaltarViaje(visitas: Pick<Visita, 'region' | 'region_ancestros'>[]): Resaltadas {
  const resaltadas: Resaltadas = new Map()
  for (const visita of visitas) {
    for (const ancestro of visita.region_ancestros) resaltadas.set(ancestro, 'contiene')
  }
  // Después, para que una región visitada que además contiene a otra (Jujuy y Tilcara) quede como directa.
  for (const visita of visitas) resaltadas.set(visita.region, 'directa')
  return resaltadas
}

/** Las regiones de un logro: los países, directos; las provincias, a su nivel, con su país marcado de lejos. */
export function resaltarLogro(objetivos: Pick<Logro['objetivos'][number], 'regiones' | 'contenedoras'>[]): Resaltadas {
  const resaltadas: Resaltadas = new Map()
  for (const objetivo of objetivos) {
    for (const contenedora of objetivo.contenedoras) resaltadas.set(contenedora, 'contiene')
  }
  // Después, para que una región de un objetivo que contiene a la de otro quede marcada como propia.
  for (const objetivo of objetivos) {
    for (const region of objetivo.regiones) {
      resaltadas.set(region, objetivo.contenedoras.length ? 'nivel' : 'directa')
    }
  }
  return resaltadas
}

/** A qué regiones acercar el mapa: solo a las elegidas. Un viaje a Jujuy acerca a Jujuy, no a toda Argentina. */
export function regionesAEncuadrar(resaltadas: Resaltadas): string[] {
  return [...resaltadas].filter(([, resaltado]) => resaltado !== 'contiene').map(([codigo]) => codigo)
}
