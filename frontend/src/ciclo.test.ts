import { describe, expect, it } from 'vitest'
import { siguientePaso } from './ciclo'
import type { TipoPresencia, Visita } from './types'

const VIAJE = 7
const REGION = 'AR-Y'

function visita(tipo_presencia: TipoPresencia, realizada = true, desde_notion = false) {
  return { id: 1, region: REGION, region_nombre: 'Jujuy', tipo_presencia, realizada, desde_notion } as Visita
}

// Cada click en modo de marcar escribe en la base: el ciclo tiene que dar siempre el paso que promete el panel.
describe('siguientePaso', () => {
  it('una región sin marcar pasa a estadía', () => {
    expect(siguientePaso(VIAJE, [], REGION)).toEqual({
      tipo: 'crear', datos: { viaje: VIAJE, region: REGION, tipo_presencia: 'estadia', realizada: true },
    })
  })

  it('estadía pasa a de paso', () => {
    expect(siguientePaso(VIAJE, [visita('estadia')], REGION)).toEqual({
      tipo: 'actualizar', id: 1, datos: { tipo_presencia: 'paso' },
    })
  })

  it('de paso pasa a tránsito', () => {
    expect(siguientePaso(VIAJE, [visita('paso')], REGION)).toEqual({
      tipo: 'actualizar', id: 1, datos: { tipo_presencia: 'transito' },
    })
  })

  it('tránsito pasa a deseo', () => {
    expect(siguientePaso(VIAJE, [visita('transito')], REGION)).toEqual({
      tipo: 'actualizar', id: 1, datos: { tipo_presencia: 'estadia', realizada: false },
    })
  })

  it('un deseo se borra y cierra el ciclo', () => {
    expect(siguientePaso(VIAJE, [visita('estadia', false)], REGION)).toEqual({ tipo: 'borrar', id: 1 })
  })

  it('una visita de Notion no se toca, en ningún paso del ciclo', () => {
    for (const v of [visita('estadia', true, true), visita('transito', true, true), visita('estadia', false, true)]) {
      expect(siguientePaso(VIAJE, [v], REGION).tipo).toBe('bloqueada')
    }
  })

  it('solo mira la región clickeada', () => {
    expect(siguientePaso(VIAJE, [visita('estadia')], 'AR-A').tipo).toBe('crear')
  })
})
