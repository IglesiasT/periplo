import { regionesAEncuadrar, resaltarRegiones, resaltarViaje, type Resaltadas } from './resaltado'
import type { Logro, Viaje } from './types'

/** Qué muestra el panel: un viaje, el formulario de uno nuevo, los logros (con uno desplegado o ninguno)
 *  o la ficha de una región. null = la lista de viajes. */
export type Seleccion =
  | { tipo: 'viaje'; id: number }
  | { tipo: 'nuevo' }
  | { tipo: 'logros'; logro: string | null }
  | { tipo: 'region'; codigo: string }
  | null

export function viajeElegido(seleccion: Seleccion, viajes: Viaje[] = []): Viaje | undefined {
  return seleccion?.tipo === 'viaje' ? viajes.find((v) => v.id === seleccion.id) : undefined
}

/** Qué se resalta en el mapa: las regiones del viaje elegido (y las que las contienen, para verlo de lejos);
 *  con un logro desplegado, las de todos sus objetivos, cumplidos o no; con una ficha abierta, su región. */
export function resaltadasDe(seleccion: Seleccion, viajes: Viaje[] = [], logros: Logro[] = []): Resaltadas {
  if (!seleccion) return new Map()
  switch (seleccion.tipo) {
    case 'viaje':
      return resaltarViaje(viajeElegido(seleccion, viajes)?.visitas ?? [])
    case 'logros': {
      const logro = logros.find((l) => l.id === seleccion.logro)
      return resaltarRegiones(logro?.objetivos.flatMap((o) => o.regiones) ?? [])
    }
    case 'region':
      return resaltarRegiones([seleccion.codigo])
    case 'nuevo':
      return new Map()
  }
}

/** A qué regiones acercar el mapa al elegir algo: a lo resaltado de forma directa. Vacío = no moverse. */
export function regionesDe(seleccion: Seleccion, viajes: Viaje[] = [], logros: Logro[] = []): string[] {
  return regionesAEncuadrar(resaltadasDe(seleccion, viajes, logros))
}
