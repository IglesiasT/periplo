import { regionesAEncuadrar, resaltarRegiones, resaltarViaje, type Resaltadas } from './resaltado'
import type { Logro, Viaje } from './types'

export const PESTANIAS = ['viajes', 'logros', 'fichas', 'numeros'] as const
export type Pestania = (typeof PESTANIAS)[number]

/**
 * Qué está elegido. Son cosas independientes porque conviven: un viaje sigue elegido y resaltado mientras
 * se mira otra pestaña o se lee la ficha de una región, y al volver está donde estaba.
 */
export interface Seleccion {
  pestania: Pestania
  /** 'nuevo' = el formulario de un viaje nuevo. */
  viaje: number | 'nuevo' | null
  /** El logro desplegado. Se resalta solo mientras se mira la pestaña de logros. */
  logro: string | null
  /** La ficha abierta: se ve encima de la pestaña. */
  region: string | null
}

export const SIN_SELECCION: Seleccion = { pestania: 'viajes', viaje: null, logro: null, region: null }

export const irAPestania = (actual: Seleccion, pestania: Pestania): Seleccion => ({ ...actual, pestania, region: null })

export const elegirViaje = (actual: Seleccion, viaje: Seleccion['viaje']): Seleccion =>
  ({ ...actual, pestania: 'viajes', viaje, region: null })

export const elegirLogro = (actual: Seleccion, logro: string | null): Seleccion =>
  ({ ...actual, pestania: 'logros', logro, region: null })

export const abrirFicha = (actual: Seleccion, region: string): Seleccion => ({ ...actual, region })

export const cerrarFicha = (actual: Seleccion): Seleccion => ({ ...actual, region: null })

export function viajeElegido(seleccion: Seleccion, viajes: Viaje[] = []): Viaje | undefined {
  return viajes.find((v) => v.id === seleccion.viaje)
}

// Lo que se resalta debajo de la ficha: un logro desplegado, o si no el viaje elegido.
function resaltadasBase(seleccion: Seleccion, viajes: Viaje[], logros: Logro[]): Resaltadas {
  const logro = seleccion.pestania === 'logros' ? logros.find((l) => l.id === seleccion.logro) : undefined
  if (logro) return resaltarRegiones(logro.objetivos.flatMap((o) => o.regiones))
  return resaltarViaje(viajeElegido(seleccion, viajes)?.visitas ?? [])
}

/** Qué se resalta en el mapa: las regiones del viaje elegido (y las que las contienen, para verlo de lejos) o,
 *  con un logro desplegado, las de todos sus objetivos, cumplidos o no. La ficha abierta se suma a eso. */
export function resaltadasDe(seleccion: Seleccion, viajes: Viaje[] = [], logros: Logro[] = []): Resaltadas {
  const resaltadas = resaltadasBase(seleccion, viajes, logros)
  return seleccion.region ? resaltadas.set(seleccion.region, 'directa') : resaltadas
}

/** A qué regiones acercar el mapa al elegir algo: a la ficha si hay una abierta; si no, a lo resaltado de forma
 *  directa. Vacío = no moverse. */
export function regionesDe(seleccion: Seleccion, viajes: Viaje[] = [], logros: Logro[] = []): string[] {
  return seleccion.region ? [seleccion.region] : regionesAEncuadrar(resaltadasBase(seleccion, viajes, logros))
}
