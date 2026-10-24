import { describe, expect, it } from 'vitest'
import { PERIODOS, periodoDe } from './periodos'

// Los años con snapshot de historical-basemaps (GET /api/historia/).
const ANIOS_DEL_MAPA = [
  -123000, -10000, -8000, -5000, -4000, -3000, -2000, -1500, -1000, -700, -500, -400, -323, -300, -200, -100, -1,
  100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1279, 1300, 1400, 1492, 1500, 1530, 1600, 1650,
  1700, 1715, 1783, 1800, 1815, 1878, 1880, 1900, 1914, 1920, 1930, 1938, 1945, 1960, 1994, 2000, 2010,
]

describe('periodoDe', () => {
  it('los períodos están en orden: cada uno termina donde empieza el siguiente', () => {
    const inicios = PERIODOS.map((p) => p.desde)
    expect(inicios).toEqual([...inicios].sort((a, b) => a - b))
    expect(new Set(inicios).size).toBe(inicios.length)
  })

  it('todos los años del mapa tienen nombre', () => {
    for (const anio of ANIOS_DEL_MAPA) expect(periodoDe(anio)).toBeTruthy()
  })

  it.each([
    [-123000, 'Paleolítico'],
    [-10000, 'Neolítico'],
    [-323, 'Período helenístico'],
    [-1, 'Imperio romano'],
    [1492, 'Renacimiento'],
    [1815, 'Era de las revoluciones'],
    [1900, 'Época victoriana'],
    [1914, 'Primera Guerra Mundial'],
    [1938, 'Entreguerras'],
    [1945, 'Segunda Guerra Mundial'],
    [1960, 'Guerra Fría'],
    [2010, 'Globalización'],
  ])('%i es %s', (anio, nombre) => {
    expect(periodoDe(anio)).toBe(nombre)
  })
})
