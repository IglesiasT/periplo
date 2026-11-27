import { ETIQUETAS_ESTADO } from '../etiquetas'
import { rangoMeses } from '../fechas'
import { colorEntidad, formatearAnio, nombreEntidad } from '../historia'
import { periodoDe } from '../periodos'
import type { Tema } from '../tema'
import type { Epoca, Estadisticas, EstadoRegion, EstadosRegiones, Viaje } from '../types'

/** Los tamaños de la lámina, en px lógicos (se rinde al doble). */
export const FORMATOS = {
  cuadrado: { nombre: 'Cuadrado', ancho: 1080, alto: 1080 },
  vertical: { nombre: 'Vertical', ancho: 1080, alto: 1920 },
  horizontal: { nombre: 'Horizontal', ancho: 1920, alto: 1080 },
} as const

export type Formato = keyof typeof FORMATOS

/** Píxeles reales por px lógico: una lámina cuadrada sale de 2160 × 2160. */
export const DENSIDAD = 2

/**
 * Cuánto más grande se ve el mapa en la lámina que en la pantalla: los rótulos y las fronteras salen 1,5 veces
 * más gruesos, para que se lean en un teléfono. Se rinde un mapa más chico con más densidad: mismos píxeles.
 */
export const ESCALA_MAPA = 1.5

export interface ItemLeyenda {
  etiqueta: string
  color: string
  /** El deseo se ve como contorno, igual que en el mapa. */
  contorno: boolean
}

export interface ContenidoLamina {
  titulo: string
  subtitulo: string
  leyenda: ItemLeyenda[]
  /** Fuentes de los datos: la del IGN la pide su licencia. */
  atribucion: string
}

export interface Contexto {
  tema: Tema
  viaje?: Viaje
  epoca?: Epoca
  estadisticas?: Estadisticas
  /** Si es falso, el hogar se ve como una región visitada más: la imagen no dice dónde vivo. */
  mostrarHogar: boolean
}

const ATRIBUCION =
  'Natural Earth · FUENTE: Instituto Geográfico Nacional de la República Argentina (límites al 11/11/2019)'
const ATRIBUCION_HISTORIA = 'Fronteras aproximadas de historical-basemaps'
const ENTIDADES_EN_LEYENDA = 4

const plural = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`

/** Título, subtítulo y leyenda: siguen a lo que se está mirando (un año, un viaje o el mapa entero). */
export function contenidoLamina({ tema, viaje, epoca, estadisticas, mostrarHogar }: Contexto): ContenidoLamina {
  if (epoca) {
    const { pisadas } = epoca
    return {
      titulo: `${formatearAnio(epoca.anio)} · ${periodoDe(epoca.anio)}`,
      subtitulo: pisadas.length === 0 ? 'No pisé territorio de ninguna entidad del mapa'
        : `Pisé territorio de ${plural(pisadas.length, 'entidad', 'entidades')}`,
      leyenda: pisadas.slice(0, ENTIDADES_EN_LEYENDA).map(({ entidad }) => ({
        etiqueta: nombreEntidad(entidad, epoca), color: colorEntidad(entidad, epoca, true, tema.aguadas), contorno: false,
      })),
      atribucion: `${ATRIBUCION} · ${ATRIBUCION_HISTORIA}`,
    }
  }

  const estados = (Object.keys(tema.estados) as EstadoRegion[]).filter((estado) => mostrarHogar || estado !== 'hogar')
  const leyenda = [
    ...estados.map((estado) => ({
      etiqueta: ETIQUETAS_ESTADO[estado], color: tema.estados[estado], contorno: estado === 'deseo',
    })),
    { etiqueta: 'Sin visitar', color: tema.mapa.noVisitado, contorno: false },
  ]

  if (viaje) {
    const lugares = new Set(viaje.visitas.filter((v) => v.realizada).map((v) => v.region)).size
    const cuando = rangoMeses(viaje.fecha_inicio, viaje.fecha_fin)
    return {
      titulo: viaje.nombre,
      subtitulo: [cuando, lugares ? plural(lugares, 'lugar', 'lugares') : ''].filter(Boolean).join(' · '),
      leyenda,
      atribucion: ATRIBUCION,
    }
  }

  return {
    titulo: tema.voz.tituloLamina,
    subtitulo: estadisticas
      ? `${estadisticas.paises_visitados} de ${estadisticas.paises_total} países · `
        + `${estadisticas.continentes_visitados} de ${estadisticas.continentes_total} continentes`
      : '',
    leyenda,
    atribucion: ATRIBUCION,
  }
}

/** El hogar pasa a ser una región visitada más. */
export function ocultarHogar(estados: EstadosRegiones): EstadosRegiones {
  return Object.fromEntries(
    Object.entries(estados).map(([codigo, estado]) => [codigo, estado === 'hogar' ? 'visitada' : estado]),
  )
}

/** Las regiones que se pintan como visitadas: lo que tiene que entrar en "todo lo visitado". */
export function codigosVisitados(estados: EstadosRegiones): string[] {
  return Object.entries(estados).filter(([, estado]) => estado !== 'deseo').map(([codigo]) => codigo).sort()
}

/** Qué abarca el mapa de la lámina: lo que se ve en pantalla, las regiones del viaje elegido o todo lo visitado. */
export type Encuadre = 'vista' | 'viaje' | 'visitado'

/** Con un viaje elegido, la lámina es de ese viaje: se encuadra entero aunque en pantalla se vea de más cerca. */
export const encuadrePorDefecto = (viaje: Viaje | undefined): Encuadre => (viaje ? 'viaje' : 'vista')

/** Las regiones que tienen que entrar en la lámina; null si se copia la vista de la pantalla. */
export function codigosParaEncuadre(
  encuadre: Encuadre, viaje: Viaje | undefined, estados: EstadosRegiones | undefined,
): string[] | null {
  const codigos = encuadre === 'viaje' ? [...new Set(viaje?.visitas.map((v) => v.region))].sort()
    : encuadre === 'visitado' ? codigosVisitados(estados ?? {})
      : []
  return codigos.length ? codigos : null
}

/**
 * El zoom para que la lámina muestre lo mismo de ancho que la pantalla: cada nivel de zoom duplica la escala,
 * así que un mapa el doble de ancho necesita un nivel más para abarcar lo mismo.
 */
export function zoomParaLamina(zoom: number, anchoPantalla: number, anchoLamina: number): number {
  if (anchoPantalla <= 0) return zoom
  return zoom + Math.log2(anchoLamina / anchoPantalla)
}

/** "Norte argentino" → "periplo-norte-argentino-2026-11-26.png"; "Mi periplo" → "mi-periplo-2026-11-26.png". */
export function nombreArchivo(titulo: string, hoy: Date): string {
  const limpio = titulo
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const fecha = [hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate()].map((n) => String(n).padStart(2, '0')).join('-')
  // "Mi periplo" no se vuelve "periplo-mi-periplo".
  return `${limpio.includes('periplo') ? limpio : `periplo-${limpio}`}-${fecha}.png`
}
