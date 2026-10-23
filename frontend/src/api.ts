import type { EstadosRegiones } from './types'

export async function obtenerEstados(): Promise<EstadosRegiones> {
  const respuesta = await fetch('/api/estados/')
  if (!respuesta.ok) {
    throw new Error(`GET /api/estados/ devolvió ${respuesta.status}`)
  }
  return respuesta.json()
}
