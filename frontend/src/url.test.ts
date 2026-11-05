import { describe, expect, it } from 'vitest'
import { type Seleccion, SIN_SELECCION } from './seleccion'
import { escribirUrl, type EstadoUrl, leerUrl } from './url'

const PRESENTE: EstadoUrl = { anio: null, lente: 'automatica', seleccion: SIN_SELECCION }
const con = (seleccion: Partial<Seleccion>): EstadoUrl => ({ ...PRESENTE, seleccion: { ...SIN_SELECCION, ...seleccion } })

describe('leerUrl y escribirUrl', () => {
  it('sin nada elegido la URL queda limpia', () => {
    expect(escribirUrl(PRESENTE)).toBe('')
    expect(leerUrl('')).toEqual(PRESENTE)
  })

  it.each<[string, EstadoUrl]>([
    ['?anio=1815', { ...PRESENTE, anio: 1815 }],
    ['?anio=-500', { ...PRESENTE, anio: -500 }],
    ['?lente=provincias', { ...PRESENTE, lente: 'provincias' }],
    ['?viaje=12', con({ viaje: 12 })],
    ['?viaje=nuevo', con({ viaje: 'nuevo' })],
    ['?pestania=numeros', con({ pestania: 'numeros' })],
    ['?pestania=logros&logro=campania_libertadora', con({ pestania: 'logros', logro: 'campania_libertadora' })],
    ['?region=AR-Y', con({ region: 'AR-Y' })],
    // Un viaje con una ficha encima, y mirando otra pestaña: siguen siendo el mismo viaje.
    ['?viaje=18&region=BOL', con({ viaje: 18, region: 'BOL' })],
    ['?pestania=fichas&viaje=18', con({ pestania: 'fichas', viaje: 18 })],
    ['?anio=1815&lente=paises&viaje=3', { anio: 1815, lente: 'paises', seleccion: { ...SIN_SELECCION, viaje: 3 } }],
  ])('%s va y vuelve', (busqueda, estado) => {
    expect(escribirUrl(estado)).toBe(busqueda)
    expect(leerUrl(busqueda)).toEqual(estado)
  })

  it('un código con caracteres raros de Natural Earth vuelve igual', () => {
    const estado = con({ region: 'ATA+00?' })
    expect(leerUrl(escribirUrl(estado))).toEqual(estado)
  })

  it.each([
    '?anio=', '?anio=hoy', '?anio=18.5', '?lente=constructor', '?lente=mundo', '?viaje=abc', '?region=', '?logro=',
    '?pestania=mapa', '?pestania=constructor',
  ])('ignora lo que no entiende: %s', (busqueda) => {
    expect(leerUrl(busqueda)).toEqual(PRESENTE)
  })
})
