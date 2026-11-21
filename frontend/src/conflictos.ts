/**
 * Visitas y marcas: dos fuentes que pueden no coincidir. La marca de una región le gana a las visitas a esa región
 * sin borrarlas. Agregar no pregunta; pisar o perder algo sí, y esto decide qué decir. Es la misma regla que
 * estados.pisa en el backend.
 */
import { ETIQUETAS_ESTADO, ETIQUETAS_MARCA } from './etiquetas'
import type { EstadoMarca, EstadoRegion, RegionDetalle } from './types'

type EstadoVisitas = 'visitada' | 'deseo'
type VisitaDetalle = RegionDetalle['visitas'][number]

const PRIORIDAD: Record<EstadoRegion, number> = { deseo: 0, visitada: 1, hogar: 2 }

/** Lo que se pinta con una marca; "no fui" no pinta nada. */
export function pintaMarca(marca: EstadoMarca): EstadoRegion | null {
  return marca === 'ninguno' ? null : marca
}

/** Las visitas a la región misma, no a lo que tiene adentro: son las únicas que una marca reemplaza. */
export function visitasPropias(region: RegionDetalle): VisitaDetalle[] {
  return region.visitas.filter((v) => v.region === region.codigo)
}

/** Lo que dicen las visitas a la región, sin marca: visitada si alguna se hizo. */
export function estadoDeVisitas(region: RegionDetalle): EstadoVisitas | null {
  const propias = visitasPropias(region)
  if (!propias.length) return null
  return propias.some((v) => v.realizada) ? 'visitada' : 'deseo'
}

/** ¿La marca esconde algo que dicen las visitas? Bajar a deseo o "no fui" sobre lo visitado, sí; agregar, no. */
export function pisa(marca: EstadoMarca, visitas: EstadoVisitas | null): boolean {
  if (visitas === null) return false
  const pintada = pintaMarca(marca)
  return (pintada === null ? -1 : PRIORIDAD[pintada]) < PRIORIDAD[visitas]
}

/** Lo que se ve de la región misma (sin lo que sube de sus hijas). */
export function estadoPropio(region: RegionDetalle): EstadoRegion | null {
  return region.marca ? pintaMarca(region.marca.estado) : estadoDeVisitas(region)
}

/**
 * El ciclo del modo de marcar sin viaje, sobre lo que se ve de la región: sin marcar → visitada → hogar → deseo →
 * sin marca (vuelve a verse lo que digan las visitas). null = sacar la marca.
 */
export function siguienteMarca(region: RegionDetalle): EstadoMarca | null {
  const marca = region.marca?.estado
  if (marca === 'visitada') return 'hogar'
  if (marca === 'hogar') return 'deseo'
  if (marca === 'deseo') return null
  // Sin marca (o "no fui"): avanza desde lo que dicen las visitas.
  return estadoDeVisitas(region) === 'visitada' && marca !== 'ninguno' ? 'hogar' : 'visitada'
}

const nombreEstado = (estado: EstadoRegion | null) => (estado ? ETIQUETAS_ESTADO[estado].toLowerCase() : 'sin visitar')

/** "visitada en Norte 2024 (Notion) y deseo sin viaje". */
function deDonde(region: RegionDetalle): string {
  const partes = visitasPropias(region).map((v) => {
    const viaje = v.viaje_nombre ? `en ${v.viaje_nombre}` : 'sin viaje'
    return `${v.realizada ? 'visitada' : 'deseo'} ${viaje}${v.desde_notion ? ' (Notion)' : ''}`
  })
  return partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}` : partes[0]
}

export interface Aviso {
  titulo: string
  mensaje: string
  aceptar: string
}

/**
 * Qué decir antes de cambiar la marca de una región a `nueva` (null = sacarla), o null si no se pisa ni se pierde
 * nada. Las visitas nunca se tocan: el aviso dice qué deja de verse.
 */
export function avisoMarca(region: RegionDetalle, nueva: EstadoMarca | null): Aviso | null {
  const visitas = estadoDeVisitas(region)
  const actual = region.marca?.estado ?? null
  if (nueva === actual) return null

  if (nueva !== null) {
    // Ya estaba pisando lo mismo con otra marca que también pisa: no hace falta volver a preguntar.
    if (!pisa(nueva, visitas) || (actual !== null && pisa(actual, visitas))) return null
    return {
      titulo: `¿Corregir ${region.nombre}?`,
      mensaje: `Las visitas la tienen como ${deDonde(region)}. Si la marcás "${ETIQUETAS_MARCA[nueva]}", el mapa `
        + `muestra ${nombreEstado(pintaMarca(nueva))}. Los viajes no cambian: si sacás la marca, vuelve a verse.`,
      aceptar: 'Marcar igual',
    }
  }

  // Sacar una marca: si coincidía con las visitas, no cambia nada de lo que se ve.
  if (actual === null || pintaMarca(actual) === visitas) return null
  const queda = visitas ? `como ${deDonde(region)}, lo que dicen las visitas` : 'sin visitar: ninguna visita la toca'
  const pierde = actual === 'hogar' ? ' Se pierde que viviste acá.' : ''
  return {
    titulo: `¿Sacar la marca de ${region.nombre}?`,
    mensaje: `Ahora está marcada "${ETIQUETAS_MARCA[actual]}". Sin la marca queda ${queda}.${pierde}`,
    aceptar: 'Sacar la marca',
  }
}
