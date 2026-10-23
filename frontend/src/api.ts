import type { Visita } from './types'

export async function obtenerVisitas(): Promise<Visita[]> {
  const respuesta = await fetch('/api/visitas/')
  if (!respuesta.ok) {
    throw new Error(`GET /api/visitas/ devolvió ${respuesta.status}`)
  }
  return respuesta.json()
}
