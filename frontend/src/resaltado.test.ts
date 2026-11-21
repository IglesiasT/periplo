import { describe, expect, it } from 'vitest'
import { regionesAEncuadrar, resaltarLogro, resaltarViaje } from './resaltado'

// Que el viaje elegido se marque en el mapa es la función principal del proyecto: estos tests la cuidan.
describe('resaltarViaje', () => {
  it('marca las visitas como directas y sus provincias y países como contenedores', () => {
    const resaltadas = resaltarViaje([
      { region: 'AR-38094', region_ancestros: ['AR-Y', 'ARG'] }, // Tilcara
      { region: 'AR-A', region_ancestros: ['ARG'] }, // Salta
    ])
    expect(Object.fromEntries(resaltadas)).toEqual({
      'AR-38094': 'directa',
      'AR-A': 'directa',
      'AR-Y': 'contiene',
      ARG: 'contiene',
    })
  })

  it('una región visitada que además contiene a otra visitada queda directa', () => {
    const resaltadas = resaltarViaje([
      { region: 'AR-38094', region_ancestros: ['AR-Y', 'ARG'] }, // Tilcara
      { region: 'AR-Y', region_ancestros: ['ARG'] }, // y toda Jujuy
    ])
    expect(resaltadas.get('AR-Y')).toBe('directa')
  })

  it('sin viaje no resalta nada', () => {
    expect(resaltarViaje([]).size).toBe(0)
  })
})

// Un logro sigue la lente: con la de países se ven países; con la de provincias, sus provincias.
describe('resaltarLogro', () => {
  it('las provincias van a su nivel y sus países se marcan de lejos', () => {
    const resaltadas = resaltarLogro([
      { regiones: ['DE-RP', 'DE-NW'], contenedoras: ['DEU'] }, // Germania, para Roma
      { regiones: ['ITA'], contenedoras: [] },
    ])
    expect(Object.fromEntries(resaltadas)).toEqual({ 'DE-RP': 'nivel', 'DE-NW': 'nivel', DEU: 'contiene', ITA: 'directa' })
  })

  it('una región de un objetivo que contiene a la de otro queda como propia', () => {
    const resaltadas = resaltarLogro([
      { regiones: ['AR-38094'], contenedoras: ['AR-Y', 'ARG'] }, // Tilcara
      { regiones: ['AR-Y'], contenedoras: ['ARG'] }, // y toda Jujuy
    ])
    expect(resaltadas.get('AR-Y')).toBe('nivel')
    expect(resaltadas.get('ARG')).toBe('contiene')
  })
})

describe('regionesAEncuadrar', () => {
  it('acerca a lo visitado, no a los países que lo contienen', () => {
    const resaltadas = resaltarViaje([{ region: 'AR-38094', region_ancestros: ['AR-Y', 'ARG'] }])
    expect(regionesAEncuadrar(resaltadas)).toEqual(['AR-38094'])
  })

  it('a las provincias de un logro, no a sus países', () => {
    const resaltadas = resaltarLogro([{ regiones: ['DE-RP'], contenedoras: ['DEU'] }])
    expect(regionesAEncuadrar(resaltadas)).toEqual(['DE-RP'])
  })
})
