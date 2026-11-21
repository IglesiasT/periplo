import { describe, expect, it } from 'vitest'
import { ordenarLogros } from './logros'
import type { Logro } from './types'

function logro(nombre: string, cumplidos: number, total: number): Logro {
  return { id: nombre, nombre, descripcion: '', cumplidos, total, completo: cumplidos === total, objetivos: [] }
}

describe('ordenarLogros', () => {
  it('arriba lo que está en curso, del más avanzado al menos; los completos, al final', () => {
    const orden = ordenarLogros([
      logro('Cuyo', 3, 3), logro('Roma', 1, 50), logro('NOA', 4, 6), logro('Patagonia', 5, 5), logro('Asiria', 0, 8),
    ]).map((l) => l.nombre)
    expect(orden).toEqual(['NOA', 'Roma', 'Asiria', 'Cuyo', 'Patagonia'])
  })
})
