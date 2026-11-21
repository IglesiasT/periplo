import type { Logro } from './types'

/** Arriba lo que está en curso, del más avanzado al menos; los completos, al final. */
export function ordenarLogros(logros: Logro[]): Logro[] {
  const avance = (l: Logro) => (l.total ? l.cumplidos / l.total : 0)
  return [...logros].sort((a, b) => Number(a.completo) - Number(b.completo) || avance(b) - avance(a)
    || a.nombre.localeCompare(b.nombre, 'es'))
}
