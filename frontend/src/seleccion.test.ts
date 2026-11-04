import { describe, expect, it } from 'vitest'
import { regionesDe, resaltadasDe, viajeElegido } from './seleccion'
import type { Logro, Viaje, Visita } from './types'

const visita = (region: string, region_ancestros: string[]) => ({ region, region_ancestros }) as Visita
const viajes = [
  { id: 1, visitas: [visita('AR-38094', ['AR-Y', 'ARG'])] }, // Tilcara
  { id: 2, visitas: [] },
] as unknown as Viaje[]
const logros = [
  {
    id: 'campania_libertadora',
    objetivos: [
      { nombre: 'Mendoza', regiones: ['AR-M'], cumplido: true },
      { nombre: 'Santiago', regiones: ['CL-RM'], cumplido: false },
    ],
  },
] as unknown as Logro[]

describe('viajeElegido', () => {
  it('busca el viaje solo si lo elegido es un viaje', () => {
    expect(viajeElegido({ tipo: 'viaje', id: 1 }, viajes)?.id).toBe(1)
    expect(viajeElegido({ tipo: 'viaje', id: 9 }, viajes)).toBeUndefined()
    expect(viajeElegido({ tipo: 'region', codigo: 'AR-Y' }, viajes)).toBeUndefined()
  })
})

describe('resaltadasDe', () => {
  it('un viaje resalta sus visitas y lo que las contiene', () => {
    expect(Object.fromEntries(resaltadasDe({ tipo: 'viaje', id: 1 }, viajes))).toEqual({
      'AR-38094': 'directa', 'AR-Y': 'contiene', ARG: 'contiene',
    })
  })

  it('un logro desplegado resalta todos sus objetivos, cumplidos o no', () => {
    const resaltadas = resaltadasDe({ tipo: 'logros', logro: 'campania_libertadora' }, viajes, logros)
    expect([...resaltadas.keys()]).toEqual(['AR-M', 'CL-RM'])
  })

  it('la ficha resalta su región', () => {
    expect([...resaltadasDe({ tipo: 'region', codigo: 'AR-Y' }).keys()]).toEqual(['AR-Y'])
  })

  it('nada elegido, un viaje nuevo o los logros sin desplegar no resaltan nada', () => {
    expect(resaltadasDe(null, viajes, logros).size).toBe(0)
    expect(resaltadasDe({ tipo: 'nuevo' }, viajes, logros).size).toBe(0)
    expect(resaltadasDe({ tipo: 'logros', logro: null }, viajes, logros).size).toBe(0)
  })
})

describe('regionesDe', () => {
  it('acerca a lo visitado, no al país que lo contiene', () => {
    expect(regionesDe({ tipo: 'viaje', id: 1 }, viajes)).toEqual(['AR-38094'])
  })

  it('un viaje sin regiones no mueve el mapa', () => {
    expect(regionesDe({ tipo: 'viaje', id: 2 }, viajes)).toEqual([])
  })
})
