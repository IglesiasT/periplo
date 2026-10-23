import { describe, expect, it } from 'vitest'
import { regionesAEncuadrar, resaltarRegiones, resaltarViaje } from './resaltado'

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

describe('resaltarRegiones', () => {
  it('marca solo las regiones pedidas, todas directas', () => {
    expect(Object.fromEntries(resaltarRegiones(['AR-M', 'CL-RM']))).toEqual({ 'AR-M': 'directa', 'CL-RM': 'directa' })
  })
})

describe('regionesAEncuadrar', () => {
  it('acerca a lo visitado, no a los países que lo contienen', () => {
    const resaltadas = resaltarViaje([{ region: 'AR-38094', region_ancestros: ['AR-Y', 'ARG'] }])
    expect(regionesAEncuadrar(resaltadas)).toEqual(['AR-38094'])
  })
})
