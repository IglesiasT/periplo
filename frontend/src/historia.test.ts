import { describe, expect, it } from 'vitest'
import { colorEntidad } from './historia'
import { atlas } from './tema/atlas'
import type { Epoca } from './types'

const epoca = (parcial: Partial<Epoca>): Epoca => ({
  anio: 1815, regiones: {}, nombres: {}, pisadas: [], rotulos: [], tonos: {}, ...parcial,
})

describe('colorEntidad', () => {
  it('usa la aguada del tono que manda la API: así dos vecinas no comparten color', () => {
    const conTono = epoca({ tonos: { Spain: 3 } })
    expect(colorEntidad('Spain', conTono, true, atlas.aguadas)).toBe(atlas.aguadas[3][0])
    expect(colorEntidad('Spain', conTono, false, atlas.aguadas)).toBe(atlas.aguadas[3][1])
  })

  it('un tono más alto que las aguadas del tema da la vuelta', () => {
    const conTono = epoca({ tonos: { Spain: atlas.aguadas.length + 2 } })
    expect(colorEntidad('Spain', conTono, true, atlas.aguadas)).toBe(atlas.aguadas[2][0])
  })
})
