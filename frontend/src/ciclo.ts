import type { DatosVisita, Visita } from './types'

/** Qué hacer al clickear una región en modo edición. */
export type Accion =
  | { tipo: 'crear'; datos: DatosVisita }
  | { tipo: 'actualizar'; id: number; datos: Partial<DatosVisita> }
  | { tipo: 'borrar'; id: number }
  | { tipo: 'bloqueada'; motivo: string }

/**
 * Cada click avanza un paso: sin marcar → visitada → deseo → sin marcar.
 * Las visitas que vienen de Notion no se tocan.
 */
export function siguientePaso(viajeId: number, visitas: Visita[], codigo: string): Accion {
  const visita = visitas.find((v) => v.region === codigo)
  if (!visita) {
    return { tipo: 'crear', datos: { viaje: viajeId, region: codigo, realizada: true } }
  }
  if (visita.desde_notion) {
    return { tipo: 'bloqueada', motivo: `${visita.region_nombre} viene de Notion: se edita allá.` }
  }
  return visita.realizada
    ? { tipo: 'actualizar', id: visita.id, datos: { realizada: false } }
    : { tipo: 'borrar', id: visita.id }
}
