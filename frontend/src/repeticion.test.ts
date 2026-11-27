import { describe, expect, it } from 'vitest'
import { cuenta, estadosHasta, nuevasEn, paradasRepeticion, rotuloDe } from './repeticion'
import type { Repeticion } from './types'

const REPETICION: Repeticion = {
  inicio: { regiones: { 'AR-C': 'hogar', ARG: 'visitada' }, paises: 1, provincias: 1 },
  pasos: [
    {
      viaje: 7, nombre: 'Norte', fecha_inicio: '2019-07-01', fecha_fin: '2019-07-20',
      regiones: { 'AR-A': 'visitada' }, paises: 1, provincias: 2,
    },
    {
      viaje: 3, nombre: 'Perú', fecha_inicio: '2023-01-10', fecha_fin: null,
      regiones: { 'PE-CUS': 'visitada', PER: 'visitada' }, paises: 2, provincias: 3,
    },
  ],
}

describe('paradasRepeticion', () => {
  it('arranca en lo que no tiene fecha, sigue por cada viaje y termina en el mapa de hoy', () => {
    expect(paradasRepeticion(REPETICION)).toEqual([0, 1, 2, null])
  })
})

describe('estadosHasta', () => {
  it('acumula lo pintado hasta esa parada', () => {
    expect(estadosHasta(REPETICION, 0)).toEqual({ 'AR-C': 'hogar', ARG: 'visitada' })
    expect(estadosHasta(REPETICION, 2)).toEqual({
      'AR-C': 'hogar', ARG: 'visitada', 'AR-A': 'visitada', 'PE-CUS': 'visitada', PER: 'visitada',
    })
  })
})

describe('nuevasEn', () => {
  it('resalta lo que pinta cada viaje, pero no el punto de partida', () => {
    expect(nuevasEn(REPETICION, 0).size).toBe(0)
    expect([...nuevasEn(REPETICION, 2)]).toEqual([['PE-CUS', 'directa'], ['PER', 'directa']])
  })
})

describe('rotuloDe y cuenta', () => {
  it('nombra cada parada', () => {
    expect(rotuloDe(REPETICION, 0)).toEqual({ titulo: 'Antes de los viajes', fecha: 'Sin fecha' })
    expect(rotuloDe(REPETICION, 1)).toEqual({ titulo: 'Norte', fecha: 'Julio 2019' })
    expect(rotuloDe(REPETICION, null).fecha).toBe('Hoy')
  })

  it('cuenta en singular y en plural', () => {
    expect(cuenta(REPETICION.inicio)).toBe('1 país · 1 provincia')
    expect(cuenta(REPETICION.pasos[1])).toBe('2 países · 3 provincias')
  })
})
