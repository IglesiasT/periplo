import { type Lente, UMBRALES } from './components/mapa/estilo'
import type { Seleccion } from './seleccion'

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

function leerSeleccion(parametros: URLSearchParams): Seleccion {
  const viaje = parametros.get('viaje')
  if (viaje === VIAJE_NUEVO) return { tipo: 'nuevo' }
  if (viaje && ENTERO.test(viaje)) return { tipo: 'viaje', id: Number(viaje) }
  if (parametros.has('logros')) return { tipo: 'logros', logro: parametros.get('logros') || null }
  const region = parametros.get('region')
  return region ? { tipo: 'region', codigo: region } : null
}

/** Lo que no se entiende (una URL escrita a mano, un enlace viejo) se ignora y queda el valor por defecto. */
export function leerUrl(busqueda: string): EstadoUrl {
  const parametros = new URLSearchParams(busqueda)
  const anio = parametros.get('anio')
  const lente = parametros.get('lente')
  return {
    anio: anio && ENTERO.test(anio) ? Number(anio) : null,
    lente: lente && Object.hasOwn(UMBRALES, lente) ? (lente as Lente) : LENTE_POR_DEFECTO,
    seleccion: leerSeleccion(parametros),
  }
}

function parametrosDeSeleccion(seleccion: Seleccion): [string, string][] {
  if (!seleccion) return []
  switch (seleccion.tipo) {
    case 'viaje':
      return [['viaje', String(seleccion.id)]]
    case 'nuevo':
      return [['viaje', VIAJE_NUEVO]]
    case 'logros':
      return [['logros', seleccion.logro ?? '']]
    case 'region':
      return [['region', seleccion.codigo]]
  }
}

/** La parte `?…` de la URL, con solo lo que no está en su valor por defecto. Vacía si no hay nada. */
export function escribirUrl({ anio, lente, seleccion }: EstadoUrl): string {
  const parametros = new URLSearchParams([
    ...(anio === null ? [] : [['anio', String(anio)]]),
    ...(lente === LENTE_POR_DEFECTO ? [] : [['lente', lente]]),
    ...parametrosDeSeleccion(seleccion),
  ])
  const texto = parametros.toString()
  return texto ? `?${texto}` : ''
}
