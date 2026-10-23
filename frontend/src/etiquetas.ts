import type { EstadoRegion, EstadoViaje, NivelRegion, TipoPresencia } from './types'

export const ETIQUETAS_ESTADO_VIAJE: Record<EstadoViaje, string> = {
  deseo: 'Deseo',
  investigando: 'Investigando',
  en_curso: 'Planificando',
  hecho: 'Hecho',
}

export const ETIQUETAS_PRESENCIA: Record<TipoPresencia, string> = {
  estadia: 'Estadía',
  paso: 'De paso',
  transito: 'Tránsito',
}

/** Cómo se ve cada región en el mapa (la leyenda y el popup): la presencia, o el deseo. */
export const ETIQUETAS_ESTADO: Record<EstadoRegion, string> = {
  ...ETIQUETAS_PRESENCIA,
  deseo: 'Por conocer',
}

export const ETIQUETAS_NIVEL: Record<NivelRegion, string> = {
  pais: 'país',
  provincia: 'provincia',
  departamento: 'departamento',
}

/** '2025-01-10' -> '10/01/2025' (sin pasar por Date, que la correría de día por la zona horaria). */
export function formatearFecha(iso: string | null): string {
  if (!iso) return ''
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}

export function rangoFechas(inicio: string | null, fin: string | null): string {
  if (inicio && fin) return inicio === fin ? formatearFecha(inicio) : `${formatearFecha(inicio)} – ${formatearFecha(fin)}`
  return formatearFecha(inicio ?? fin)
}
