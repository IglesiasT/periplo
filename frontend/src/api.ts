import type { DatosViaje, DatosVisita, Estadisticas, EstadosRegiones, Ruta, Viaje, Visita } from './types'

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
  // FormData (subida de archivos) va tal cual: el navegador arma el multipart y su Content-Type.
  const esFormulario = cuerpo instanceof FormData
  const respuesta = await fetch(url, {
    method: metodo,
    headers: cuerpo === undefined || esFormulario ? {} : { 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : esFormulario ? cuerpo : JSON.stringify(cuerpo),
  })
  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, await respuesta.json().catch(() => null))
  }
  return respuesta.status === 204 ? (undefined as T) : respuesta.json()
}

export const obtenerEstados = () => pedir<EstadosRegiones>('GET', '/api/estados/')
export const obtenerEstadisticas = () => pedir<Estadisticas>('GET', '/api/estadisticas/')

export const listarViajes = () => pedir<Viaje[]>('GET', '/api/viajes/')
export const crearViaje = (datos: DatosViaje) => pedir<Viaje>('POST', '/api/viajes/', datos)
export const actualizarViaje = (id: number, datos: Partial<DatosViaje>) =>
  pedir<Viaje>('PATCH', `/api/viajes/${id}/`, datos)
export const borrarViaje = (id: number) => pedir<void>('DELETE', `/api/viajes/${id}/`)

export const crearVisita = (datos: DatosVisita) => pedir<Visita>('POST', '/api/visitas/', datos)
export const actualizarVisita = (id: number, datos: Partial<DatosVisita>) =>
  pedir<Visita>('PATCH', `/api/visitas/${id}/`, datos)
export const borrarVisita = (id: number) => pedir<void>('DELETE', `/api/visitas/${id}/`)

export const listarRutas = () => pedir<Ruta[]>('GET', '/api/rutas/')
export const crearRuta = (datos: Pick<Ruta, 'viaje' | 'coordenadas'> & { nombre?: string }) =>
  pedir<Ruta>('POST', '/api/rutas/', datos)
export const borrarRuta = (id: number) => pedir<void>('DELETE', `/api/rutas/${id}/`)
export function importarRutas(viaje: number, archivo: File) {
  const formulario = new FormData()
  formulario.append('viaje', String(viaje))
  formulario.append('archivo', archivo)
  return pedir<Ruta[]>('POST', '/api/rutas/importar/', formulario)
}
export const marcarTransito = (id: number) =>
  pedir<{ agregadas: string[]; ya_estaban: number }>('POST', `/api/rutas/${id}/marcar_transito/`)
