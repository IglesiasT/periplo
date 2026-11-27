import { rangoMeses } from './fechas'
import type { Resaltadas } from './resaltado'
import type { EstadosRegiones, MomentoRepeticion, Repeticion } from './types'

/** Una parada de la repetición: 0 es lo que no tiene fecha, 1… cada viaje, y null el mapa de hoy (sin repetición). */
export type ParadaRepeticion = number | null

export function paradasRepeticion(repeticion: Repeticion): ParadaRepeticion[] {
  return [0, ...repeticion.pasos.map((_, i) => i + 1), null]
}

export function momentoDe(repeticion: Repeticion, parada: number): MomentoRepeticion {
  return parada === 0 ? repeticion.inicio : repeticion.pasos[parada - 1]
}

/** Lo pintado hasta esa parada, incluida: cada momento solo trae lo que pinta por primera vez. */
export function estadosHasta(repeticion: Repeticion, parada: number): EstadosRegiones {
  const estados: EstadosRegiones = {}
  for (let i = 0; i <= parada; i++) Object.assign(estados, momentoDe(repeticion, i).regiones)
  return estados
}

/** Lo que pinta esa parada se resalta mientras se la mira. Lo de antes de los viajes no: es el punto de partida. */
export function nuevasEn(repeticion: Repeticion, parada: number): Resaltadas {
  if (parada === 0) return new Map()
  return new Map(Object.keys(momentoDe(repeticion, parada).regiones).map((codigo) => [codigo, 'directa']))
}

/** El título y la fecha de una parada. */
export function rotuloDe(repeticion: Repeticion, parada: ParadaRepeticion): { titulo: string; fecha: string } {
  if (parada === null) return { titulo: 'El mapa de hoy', fecha: 'Hoy' }
  if (parada === 0) return { titulo: 'Antes de los viajes', fecha: 'Sin fecha' }
  const paso = repeticion.pasos[parada - 1]
  return { titulo: paso.nombre, fecha: rangoMeses(paso.fecha_inicio, paso.fecha_fin) }
}

/** '3 países · 12 provincias': lo pintado hasta ahí. */
export function cuenta({ paises, provincias }: MomentoRepeticion): string {
  const plural = (n: number, singular: string, varios: string) => `${n} ${n === 1 ? singular : varios}`
  return `${plural(paises, 'país', 'países')} · ${plural(provincias, 'provincia', 'provincias')}`
}
