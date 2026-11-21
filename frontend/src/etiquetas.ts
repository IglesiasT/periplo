import type { EstadoRegion, EstadoViaje, NivelRegion, Visita } from './types'

export const ETIQUETAS_ESTADO_VIAJE: Record<EstadoViaje, string> = {
  deseo: 'Deseo',
  investigando: 'Investigando',
  en_curso: 'Planificando',
  hecho: 'Hecho',
}

/** Cómo se ve cada región en el mapa (la leyenda y el popup). */
export const ETIQUETAS_ESTADO: Record<EstadoRegion, string> = {
  visitada: 'Visitada',
  deseo: 'Deseo',
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

/** Cómo se cuenta una visita: visitada si ya fui; si no, es un deseo. */
export function etiquetaVisita({ realizada }: Pick<Visita, 'realizada'>): string {
  return ETIQUETAS_ESTADO[realizada ? 'visitada' : 'deseo']
}

const contar = (cantidad: number, singular: string, plural: string) => `${cantidad} ${cantidad === 1 ? singular : plural}`

/** Borrar un viaje se lleva sus visitas y sus fotos: las fotos salen también del disco y no hay cómo recuperarlas. */
export function mensajeBorrarViaje(nombre: string, regiones: number, fotos: number): string {
  const adentro = [
    ...(regiones ? [contar(regiones, 'región', 'regiones')] : []),
    ...(fotos ? [contar(fotos, 'foto', 'fotos')] : []),
  ]
  const pregunta = adentro.length ? `¿Borrar "${nombre}", con ${adentro.join(' y ')}?` : `¿Borrar "${nombre}"?`
  return fotos ? `${pregunta} Las fotos se borran del disco y no se pueden recuperar.` : pregunta
}
