import type { Tema } from '../tema'
import { FORMATOS, type Formato } from './contenido'

export interface Rect {
  x: number
  y: number
  ancho: number
  alto: number
}

/** Dónde va cada cosa en la lámina, en px lógicos. */
export interface Layout {
  lienzo: { ancho: number; alto: number }
  /** El marco que rodea todo: doble en la cartela, esquinas en el HUD. */
  marco: Rect
  /** Separación entre las dos líneas del marco doble, o largo de las esquinas del HUD. */
  ornamento: number
  mapa: Rect
  pie: Rect
  rosa: Rect | null
  /** Línea de base de cada texto del pie, y su tamaño de letra. */
  textos: Record<'titulo' | 'subtitulo' | 'leyenda' | 'atribucion', { y: number; tam: number }>
}

/** Proporciones respecto del lado corto: la misma lámina se ve igual en los tres formatos. */
const MARGEN = 0.035
const AIRE = 0.016
const ALTO_PIE = 0.2
const LADO_ROSA = 0.1
const TAM = { titulo: 0.05, subtitulo: 0.027, leyenda: 0.021, atribucion: 0.0125 }

export function layoutLamina(formato: Formato, tipo: Tema['rasgos']['lamina'], conRosa: boolean): Layout {
  const { ancho, alto } = FORMATOS[formato]
  const base = Math.min(ancho, alto)
  const margen = Math.round(base * MARGEN)
  const aire = Math.round(base * AIRE)
  const altoPie = Math.round(base * ALTO_PIE)

  const marco = { x: margen, y: margen, ancho: ancho - 2 * margen, alto: alto - 2 * margen }
  const interior = { x: marco.x + aire, y: marco.y + aire, ancho: marco.ancho - 2 * aire, alto: marco.alto - 2 * aire }
  const mapa = { ...interior, alto: interior.alto - altoPie }
  const pie = { x: interior.x, y: mapa.y + mapa.alto, ancho: interior.ancho, alto: altoPie }

  const tam = Object.fromEntries(Object.entries(TAM).map(([texto, t]) => [texto, Math.round(base * t)])) as
    Record<keyof typeof TAM, number>
  // De arriba hacia abajo, cada línea de base a su tamaño más un poco de aire.
  const respiro = Math.round(base * 0.014)
  const titulo = pie.y + Math.round(respiro * 1.5) + tam.titulo
  const subtitulo = titulo + respiro + tam.subtitulo
  const leyenda = subtitulo + respiro * 1.6 + tam.leyenda
  const atribucion = pie.y + pie.alto - Math.round(respiro * 0.3)

  const lado = Math.round(base * LADO_ROSA)
  const rosa = conRosa
    ? { x: mapa.x + mapa.ancho - lado - aire, y: mapa.y + aire, ancho: lado, alto: lado }
    : null

  return {
    lienzo: { ancho, alto },
    marco,
    ornamento: tipo === 'cartela' ? Math.round(aire * 0.4) : Math.round(base * 0.05),
    mapa,
    pie,
    rosa,
    textos: {
      titulo: { y: titulo, tam: tam.titulo },
      subtitulo: { y: subtitulo, tam: tam.subtitulo },
      leyenda: { y: leyenda, tam: tam.leyenda },
      atribucion: { y: atribucion, tam: tam.atribucion },
    },
  }
}
