import { describe, expect, it } from 'vitest'
import { avisoMarca, pisa, siguienteMarca } from './conflictos'
import type { EstadoMarca, RegionDetalle } from './types'

function region(visitas: Partial<RegionDetalle['visitas'][number]>[] = [], marca: EstadoMarca | null = null) {
  return {
    codigo: 'AR-90119', nombre: 'Yerba Buena', nivel: 'departamento', ancestros: [], ficha: null, historia: [],
    marca: marca && { estado: marca, actualizada: '2026-11-21' },
    visitas: visitas.map((v, i) => ({
      id: i, viaje: 1, viaje_nombre: 'Norte 2024', viaje_inicio: null, viaje_fin: null,
      region: 'AR-90119', region_nombre: 'Yerba Buena', realizada: true, desde_notion: true, ...v,
    })),
  } as RegionDetalle
}

describe('pisa', () => {
  it('agregar no pisa', () => {
    expect(pisa('visitada', null)).toBe(false)
    expect(pisa('visitada', 'deseo')).toBe(false)
    expect(pisa('hogar', 'visitada')).toBe(false)
  })

  it('bajar o anular lo que dicen las visitas pisa', () => {
    expect(pisa('deseo', 'visitada')).toBe(true)
    expect(pisa('ninguno', 'visitada')).toBe(true)
    expect(pisa('ninguno', 'deseo')).toBe(true)
  })
})

describe('avisoMarca', () => {
  it('marcar algo nuevo no pregunta', () => {
    expect(avisoMarca(region(), 'hogar')).toBeNull()
    expect(avisoMarca(region([{ realizada: false }]), 'visitada')).toBeNull()
  })

  it('pisar una visita de Notion avisa de dónde viene y que el viaje no cambia', () => {
    const aviso = avisoMarca(region([{}]), 'deseo')
    expect(aviso?.mensaje).toContain('visitada en Norte 2024 (Notion)')
    expect(aviso?.mensaje).toContain('Los viajes no cambian')
  })

  it('no vuelve a preguntar si ya estaba pisando', () => {
    expect(avisoMarca(region([{}], 'deseo'), 'ninguno')).toBeNull()
  })

  it('sacar una marca que pisa dice cómo queda', () => {
    expect(avisoMarca(region([{}], 'ninguno'), null)?.mensaje).toContain('lo que dicen las visitas')
  })

  it('sacar un hogar avisa que se pierde', () => {
    expect(avisoMarca(region([], 'hogar'), null)?.mensaje).toContain('Se pierde que viviste acá')
  })

  it('sacar una marca que coincide con las visitas no pregunta', () => {
    expect(avisoMarca(region([{}], 'visitada'), null)).toBeNull()
  })
})

describe('siguienteMarca', () => {
  it('recorre sin marcar → visitada → hogar → deseo → sin marca', () => {
    expect(siguienteMarca(region())).toBe('visitada')
    expect(siguienteMarca(region([], 'visitada'))).toBe('hogar')
    expect(siguienteMarca(region([], 'hogar'))).toBe('deseo')
    expect(siguienteMarca(region([], 'deseo'))).toBeNull()
  })

  it('arranca desde lo que se ve: lo ya visitado pasa a hogar', () => {
    expect(siguienteMarca(region([{}]))).toBe('hogar')
    expect(siguienteMarca(region([{ realizada: false }]))).toBe('visitada')
    expect(siguienteMarca(region([{}], 'ninguno'))).toBe('visitada')
  })
})
