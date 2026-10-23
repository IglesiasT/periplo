import type { DatosVisita, TipoPresencia, Visita } from './types'

/** Qué hacer al clickear una región en modo edición. */
export type Accion =
  | { tipo: 'crear'; datos: DatosVisita }
  | { tipo: 'actualizar'; id: number; datos: Partial<DatosVisita> }
  | { tipo: 'borrar'; id: number }
  | { tipo: 'bloqueada'; motivo: string }

const SIGUIENTE_PRESENCIA: Record<TipoPresencia, TipoPresencia | null> = {
  estadia: 'paso',
  paso: 'transito',
  transito: null, // después de tránsito viene "deseo"
}

/**
 * Cada click avanza un paso: sin marcar → estadía → de paso → tránsito → deseo → sin marcar.
 * Las visitas que vienen de Notion no se tocan.
 */
export function siguientePaso(viajeId: number, visitas: Visita[], codigo: string): Accion {
  const visita = visitas.find((v) => v.region === codigo)
  if (!visita) {
    return { tipo: 'crear', datos: { viaje: viajeId, region: codigo, tipo_presencia: 'estadia', realizada: true } }
  }
  if (visita.desde_notion) {
    return { tipo: 'bloqueada', motivo: `${visita.region_nombre} viene de Notion: se edita allá.` }
  }
  if (!visita.realizada) {
    return { tipo: 'borrar', id: visita.id }
  }
  const siguiente = SIGUIENTE_PRESENCIA[visita.tipo_presencia]
  return siguiente
    ? { tipo: 'actualizar', id: visita.id, datos: { tipo_presencia: siguiente } }
    : { tipo: 'actualizar', id: visita.id, datos: { tipo_presencia: 'estadia', realizada: false } }
}
