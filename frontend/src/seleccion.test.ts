import { describe, expect, it } from 'vitest'
import {
  abrirFicha, cerrarFicha, elegirLogro, elegirViaje, irAPestania, regionesDe, resaltadasDe, type Seleccion,
  SIN_SELECCION, viajeElegido,
} from './seleccion'
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

const conViaje: Seleccion = { ...SIN_SELECCION, viaje: 1 }
const RESALTADO_DEL_VIAJE = { 'AR-38094': 'directa', 'AR-Y': 'contiene', ARG: 'contiene' }

describe('viajeElegido', () => {
  it('busca el viaje elegido', () => {
    expect(viajeElegido(conViaje, viajes)?.id).toBe(1)
    expect(viajeElegido({ ...SIN_SELECCION, viaje: 9 }, viajes)).toBeUndefined()
    expect(viajeElegido({ ...SIN_SELECCION, viaje: 'nuevo' }, viajes)).toBeUndefined()
    expect(viajeElegido(SIN_SELECCION, viajes)).toBeUndefined()
  })
})

// Que el viaje elegido siga marcado en el mapa es la función principal del proyecto.
describe('el viaje elegido sigue resaltado', () => {
  it('al elegirlo, con sus visitas y lo que las contiene', () => {
    expect(Object.fromEntries(resaltadasDe(elegirViaje(SIN_SELECCION, 1), viajes))).toEqual(RESALTADO_DEL_VIAJE)
  })

  it('al abrir la ficha de una región, que se suma a lo resaltado', () => {
    const conFicha = abrirFicha(conViaje, 'BOL')
    expect(viajeElegido(conFicha, viajes)?.id).toBe(1)
    expect(Object.fromEntries(resaltadasDe(conFicha, viajes))).toEqual({ ...RESALTADO_DEL_VIAJE, BOL: 'directa' })
  })

  it('al cerrar la ficha', () => {
    const cerrada = cerrarFicha(abrirFicha(conViaje, 'BOL'))
    expect(Object.fromEntries(resaltadasDe(cerrada, viajes))).toEqual(RESALTADO_DEL_VIAJE)
  })

  it('al ir a otra pestaña', () => {
    for (const pestania of ['logros', 'fichas', 'numeros'] as const) {
      expect(Object.fromEntries(resaltadasDe(irAPestania(conViaje, pestania), viajes, logros)))
        .toEqual(RESALTADO_DEL_VIAJE)
    }
  })

  it('al plegar un logro', () => {
    const plegado = elegirLogro(elegirLogro(conViaje, 'campania_libertadora'), null)
    expect(Object.fromEntries(resaltadasDe(plegado, viajes, logros))).toEqual(RESALTADO_DEL_VIAJE)
  })

  it('una ficha sobre una región del viaje la deja directa', () => {
    expect(resaltadasDe(abrirFicha(conViaje, 'AR-Y'), viajes).get('AR-Y')).toBe('directa')
  })
})

describe('resaltadasDe', () => {
  it('un logro desplegado resalta todos sus objetivos en lugar del viaje', () => {
    const resaltadas = resaltadasDe(elegirLogro(conViaje, 'campania_libertadora'), viajes, logros)
    expect([...resaltadas.keys()]).toEqual(['AR-M', 'CL-RM'])
  })

  it('el logro desplegado se resalta solo en su pestaña', () => {
    const enNumeros = irAPestania(elegirLogro(SIN_SELECCION, 'campania_libertadora'), 'numeros')
    expect(resaltadasDe(enNumeros, viajes, logros).size).toBe(0)
  })

  it('sin nada elegido, o con un viaje nuevo, no resalta nada', () => {
    expect(resaltadasDe(SIN_SELECCION, viajes, logros).size).toBe(0)
    expect(resaltadasDe({ ...SIN_SELECCION, viaje: 'nuevo' }, viajes, logros).size).toBe(0)
  })

  it('no acumula entre llamadas', () => {
    resaltadasDe(abrirFicha(conViaje, 'BOL'), viajes)
    expect(resaltadasDe(conViaje, viajes).has('BOL')).toBe(false)
  })
})

describe('regionesDe', () => {
  it('acerca a lo visitado, no al país que lo contiene', () => {
    expect(regionesDe(conViaje, viajes)).toEqual(['AR-38094'])
  })

  it('con una ficha abierta acerca solo a su región, no al viaje', () => {
    expect(regionesDe(abrirFicha(conViaje, 'BOL'), viajes)).toEqual(['BOL'])
  })

  it('un viaje sin regiones no mueve el mapa', () => {
    expect(regionesDe({ ...SIN_SELECCION, viaje: 2 }, viajes)).toEqual([])
  })
})

describe('las transiciones', () => {
  it('cambiar de pestaña cierra la ficha y conserva el resto', () => {
    expect(irAPestania(abrirFicha(conViaje, 'BOL'), 'numeros')).toEqual({ ...conViaje, pestania: 'numeros' })
  })

  it('elegir un viaje desde una ficha lleva a su pestaña', () => {
    const desdeFichas = abrirFicha(irAPestania(SIN_SELECCION, 'fichas'), 'BOL')
    expect(elegirViaje(desdeFichas, 2)).toEqual({ ...SIN_SELECCION, viaje: 2 })
  })
})
