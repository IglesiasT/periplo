import { describe, expect, it } from 'vitest'
import { escribirUrl, type EstadoUrl, leerUrl } from './url'

const PRESENTE: EstadoUrl = { anio: null, lente: 'automatica', seleccion: null }

describe('leerUrl y escribirUrl', () => {
  it('sin nada elegido la URL queda limpia', () => {
    expect(escribirUrl(PRESENTE)).toBe('')
    expect(leerUrl('')).toEqual(PRESENTE)
  })

  it.each<[string, EstadoUrl]>([
    ['?anio=1815', { ...PRESENTE, anio: 1815 }],
    ['?anio=-500', { ...PRESENTE, anio: -500 }],
    ['?lente=provincias', { ...PRESENTE, lente: 'provincias' }],
    ['?viaje=12', { ...PRESENTE, seleccion: { tipo: 'viaje', id: 12 } }],
    ['?viaje=nuevo', { ...PRESENTE, seleccion: { tipo: 'nuevo' } }],
    ['?logros=', { ...PRESENTE, seleccion: { tipo: 'logros', logro: null } }],
    ['?logros=campania_libertadora', { ...PRESENTE, seleccion: { tipo: 'logros', logro: 'campania_libertadora' } }],
    ['?region=AR-Y', { ...PRESENTE, seleccion: { tipo: 'region', codigo: 'AR-Y' } }],
    ['?anio=1815&lente=paises&viaje=3', { anio: 1815, lente: 'paises', seleccion: { tipo: 'viaje', id: 3 } }],
  ])('%s va y vuelve', (busqueda, estado) => {
    expect(escribirUrl(estado)).toBe(busqueda)
    expect(leerUrl(busqueda)).toEqual(estado)
  })

  it('un código con caracteres raros de Natural Earth vuelve igual', () => {
    const estado: EstadoUrl = { ...PRESENTE, seleccion: { tipo: 'region', codigo: 'ATA+00?' } }
    expect(leerUrl(escribirUrl(estado))).toEqual(estado)
  })

  it.each(['?anio=', '?anio=hoy', '?anio=18.5', '?lente=constructor', '?lente=mundo', '?viaje=abc', '?region='])(
    'ignora lo que no entiende: %s',
    (busqueda) => {
      expect(leerUrl(busqueda)).toEqual(PRESENTE)
    },
  )
})
