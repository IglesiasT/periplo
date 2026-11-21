import { describe, expect, it } from 'vitest'
import { siguientePaso } from './ciclo'
import type { Visita } from './types'

const VIAJE = 7
const REGION = 'AR-Y'

function visita(realizada = true, desde_notion = false) {
  return { id: 1, region: REGION, region_nombre: 'Jujuy', realizada, desde_notion } as Visita
}

// Cada click en modo de marcar escribe en la base: el ciclo tiene que dar siempre el paso que promete el panel.
describe('siguientePaso', () => {
  it('una región sin marcar pasa a visitada', () => {
    expect(siguientePaso(VIAJE, [], REGION)).toEqual({
      tipo: 'crear', datos: { viaje: VIAJE, region: REGION, realizada: true },
    })
  })

  it('visitada pasa a deseo', () => {
    expect(siguientePaso(VIAJE, [visita()], REGION)).toEqual({
      tipo: 'actualizar', id: 1, datos: { realizada: false },
    })
  })

  it('un deseo se borra y cierra el ciclo', () => {
    expect(siguientePaso(VIAJE, [visita(false)], REGION)).toEqual({ tipo: 'borrar', id: 1 })
  })

  it('una visita de Notion no se toca, en ningún paso del ciclo', () => {
    for (const v of [visita(true, true), visita(false, true)]) {
      expect(siguientePaso(VIAJE, [v], REGION).tipo).toBe('bloqueada')
    }
  })

  it('solo mira la región clickeada', () => {
    expect(siguientePaso(VIAJE, [visita()], 'AR-A').tipo).toBe('crear')
  })
})
