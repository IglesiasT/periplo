import type { DatosViaje, DatosVisita, EstadosRegiones, Viaje, Visita } from './types'

/** Error de la API. DRF devuelve los errores de validación como { campo: ["mensaje"] }. */
export class ErrorApi extends Error {
  readonly status: number
  readonly campos: Record<string, string[]>

  constructor(status: number, cuerpo: unknown) {
    const campos = typeof cuerpo === 'object' && cuerpo !== null ? (cuerpo as Record<string, unknown>) : {}
    const normalizados = Object.fromEntries(
      Object.entries(campos).map(([campo, msj]) => [campo, Array.isArray(msj) ? msj.map(String) : [String(msj)]]),
    )
    super(normalizados.detail?.[0] ?? `La API respondió ${status}`)
    this.status = status
    this.campos = normalizados
  }
}

async function pedir<T>(metodo: string, url: string, cuerpo?: unknown): Promise<T> {
  const respuesta = await fetch(url, {
    method: metodo,
    headers: cuerpo === undefined ? {} : { 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, await respuesta.json().catch(() => null))
  }
  return respuesta.status === 204 ? (undefined as T) : respuesta.json()
}

export const obtenerEstados = () => pedir<EstadosRegiones>('GET', '/api/estados/')

export const listarViajes = () => pedir<Viaje[]>('GET', '/api/viajes/')
export const crearViaje = (datos: DatosViaje) => pedir<Viaje>('POST', '/api/viajes/', datos)
export const actualizarViaje = (id: number, datos: Partial<DatosViaje>) =>
  pedir<Viaje>('PATCH', `/api/viajes/${id}/`, datos)
export const borrarViaje = (id: number) => pedir<void>('DELETE', `/api/viajes/${id}/`)

export const crearVisita = (datos: DatosVisita) => pedir<Visita>('POST', '/api/visitas/', datos)
export const actualizarVisita = (id: number, datos: Partial<DatosVisita>) =>
  pedir<Visita>('PATCH', `/api/visitas/${id}/`, datos)
export const borrarVisita = (id: number) => pedir<void>('DELETE', `/api/visitas/${id}/`)
