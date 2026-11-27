import { describe, expect, it } from 'vitest'
import geojson from '../public/geo/paises.geojson?raw'
import { paisConBandera, urlBandera } from './banderas'
import { BANDERAS } from './banderasDisponibles'

const paises: { codigo: string; iso_a2?: string }[] = JSON.parse(geojson).features
  .map((f: { properties: object }) => f.properties)
// Solo los nombres: no se carga ninguna.
const archivos = new Set(Object.keys(import.meta.glob('../public/banderas/*.svg'))
  .map((ruta) => ruta.replace(/^.*\/(\w+)\.svg$/, '$1')))

describe('banderas', () => {
  it('cada bandera de la lista existe en public/banderas/', () => {
    expect([...BANDERAS].filter((codigo) => !archivos.has(codigo))).toEqual([])
    expect([...archivos].filter((codigo) => !BANDERAS.has(codigo))).toEqual([])
  })

  it('tienen bandera casi todos los países: si faltan muchas, hay que correr npm run banderas', () => {
    expect(BANDERAS.has('ARG')).toBe(true)
    expect(paises.filter((p) => p.iso_a2 && !BANDERAS.has(p.codigo))).toEqual([])
  })

  it('las Islas del Atlántico Sur no tienen bandera propia: son parte de ARG', () => {
    expect(BANDERAS.has('FLK')).toBe(false)
    expect(BANDERAS.has('SGS')).toBe(false)
  })

  it('urlBandera devuelve null si el país no tiene', () => {
    expect(urlBandera('ARG')).toBe('/banderas/ARG.svg')
    expect(urlBandera('SOL')).toBeNull()
    expect(urlBandera(undefined)).toBeNull()
  })

  it('el país de una provincia o un departamento es el primero hacia arriba con bandera', () => {
    expect(paisConBandera(['ARG'])).toBe('ARG')
    expect(paisConBandera(['AR-T', 'ARG'])).toBe('ARG')
    expect(paisConBandera(['AR-90077', 'AR-T', 'ARG'])).toBe('ARG')
    expect(paisConBandera(['SOL-1', 'SOL'])).toBeUndefined()
  })
})
