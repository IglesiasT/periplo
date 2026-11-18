import type { EstadoRegion, EstadoViaje, NivelRegion, TipoPresencia, Visita } from './types'

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

export function rangoFechas(inicio: string | null, fin: string | null): string {
  if (inicio && fin) return inicio === fin ? formatearFecha(inicio) : `${formatearFecha(inicio)} – ${formatearFecha(fin)}`
  return formatearFecha(inicio ?? fin)
}

/** Cómo se cuenta una visita: su presencia si ya fui; si no, es un deseo. */
export function etiquetaVisita({ realizada, tipo_presencia }: Pick<Visita, 'realizada' | 'tipo_presencia'>): string {
  return realizada ? ETIQUETAS_PRESENCIA[tipo_presencia] : ETIQUETAS_ESTADO.deseo
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
