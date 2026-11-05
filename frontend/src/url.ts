import { type Lente, UMBRALES } from './components/mapa/estilo'
import { type Pestania, PESTANIAS, type Seleccion, SIN_SELECCION } from './seleccion'

/** Lo que se guarda en la URL: al recargar o abrir un enlace se vuelve a lo mismo.
 *  La posición del mapa va aparte, en el hash (ver components/mapa/vista.ts). */
export interface EstadoUrl {
  /** null = el presente. */
  anio: number | null
  lente: Lente
  seleccion: Seleccion
}

const ENTERO = /^-?\d+$/
const LENTE_POR_DEFECTO: Lente = 'automatica'
const VIAJE_NUEVO = 'nuevo'

function leerViaje(viaje: string | null): Seleccion['viaje'] {
  if (viaje === VIAJE_NUEVO) return 'nuevo'
  return viaje && ENTERO.test(viaje) ? Number(viaje) : null
}

/** Lo que no se entiende (una URL escrita a mano, un enlace viejo) se ignora y queda el valor por defecto. */
export function leerUrl(busqueda: string): EstadoUrl {
  const parametros = new URLSearchParams(busqueda)
  const anio = parametros.get('anio')
  const lente = parametros.get('lente')
  const pestania = parametros.get('pestania') as Pestania | null
  return {
    anio: anio && ENTERO.test(anio) ? Number(anio) : null,
    lente: lente && Object.hasOwn(UMBRALES, lente) ? (lente as Lente) : LENTE_POR_DEFECTO,
    seleccion: {
      pestania: pestania && PESTANIAS.includes(pestania) ? pestania : SIN_SELECCION.pestania,
      viaje: leerViaje(parametros.get('viaje')),
      logro: parametros.get('logro') || null,
      region: parametros.get('region') || null,
    },
  }
}

/** La parte `?…` de la URL, con solo lo que no está en su valor por defecto. Vacía si no hay nada. */
export function escribirUrl({ anio, lente, seleccion }: EstadoUrl): string {
  const { pestania, viaje, logro, region } = seleccion
  const pares: [string, string | null][] = [
    ['anio', anio === null ? null : String(anio)],
    ['lente', lente === LENTE_POR_DEFECTO ? null : lente],
    ['pestania', pestania === SIN_SELECCION.pestania ? null : pestania],
    ['viaje', viaje === null ? null : String(viaje)],
    ['logro', logro],
    ['region', region],
  ]
  const texto = new URLSearchParams(pares.filter((par): par is [string, string] => par[1] !== null)).toString()
  return texto ? `?${texto}` : ''
}
