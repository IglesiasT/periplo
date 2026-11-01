import { describe, expect, it } from 'vitest'
import { colorEntidad } from './historia'
import { atlas } from './tema/atlas'
import type { Epoca } from './types'

const epoca = (parcial: Partial<Epoca>): Epoca => ({
  anio: 1815, regiones: {}, colores: {}, nombres: {}, pisadas: [], rotulos: [], tonos: {}, ...parcial,
})

describe('colorEntidad', () => {
  it('usa la aguada del tono que manda la API: así dos vecinas no comparten color', () => {
    const conTono = epoca({ tonos: { Spain: 3 } })
    expect(colorEntidad('Spain', conTono, true, atlas.aguadas)).toBe(atlas.aguadas[3][0])
    expect(colorEntidad('Spain', conTono, false, atlas.aguadas)).toBe(atlas.aguadas[3][1])
  })

  it('sin tono, el color de siempre: el del hash de su nombre (Spain da 4, igual que en el backend)', () => {
    expect(colorEntidad('Spain', epoca({}), true, atlas.aguadas)).toBe(atlas.aguadas[4][0])
  })

  it('el color propio de la entidad gana siempre', () => {
    expect(colorEntidad('Spain', epoca({ colores: { Spain: '#123456' }, tonos: { Spain: 3 } }), true, atlas.aguadas))
      .toBe('#123456')
  })
})
