import { describe, expect, it } from 'vitest'
import { esAntiguo, paradaAnterior, paradasDe, paradaSiguiente } from './paradas'

const ANIOS = [-123000, -500, -1, 100, 1815]

describe('paradasDe', () => {
  it('arranca en el cambio de era y termina en el presente', () => {
    expect(paradasDe(ANIOS, false)).toEqual([-1, 100, 1815, null])
  })

  it('con los antiguos, todos los años', () => {
    expect(paradasDe(ANIOS, true)).toEqual([-123000, -500, -1, 100, 1815, null])
  })

  it('sin años, solo el presente', () => {
    expect(paradasDe([], false)).toEqual([null])
  })
})

describe('esAntiguo', () => {
  it('distingue lo plegado de lo que queda a la vista', () => {
    expect(esAntiguo(-500)).toBe(true)
    expect(esAntiguo(-1)).toBe(false)
    expect(esAntiguo(1815)).toBe(false)
    expect(esAntiguo(null)).toBe(false)
  })
})

describe('paradaSiguiente y paradaAnterior', () => {
  const paradas = paradasDe(ANIOS, false)

  it('avanzan de a una, sin importar cuántos años haya entre medio', () => {
    expect(paradaSiguiente(paradas, 100)).toBe(1815)
    expect(paradaAnterior(paradas, 1815)).toBe(100)
  })

  it('del último año se pasa al presente, y del presente se vuelve al último', () => {
    expect(paradaSiguiente(paradas, 1815)).toBeNull()
    expect(paradaAnterior(paradas, null)).toBe(1815)
  })

  it('en los extremos no hay a dónde ir', () => {
    expect(paradaSiguiente(paradas, null)).toBeUndefined()
    expect(paradaAnterior(paradas, -1)).toBeUndefined()
  })
})
