import { describe, expect, it } from 'vitest'
import { FORMATOS, type Formato } from './contenido'
import { layoutLamina, type Rect } from './layout'

const dentro = (r: Rect, de: Rect) =>
  r.x >= de.x && r.y >= de.y && r.x + r.ancho <= de.x + de.ancho && r.y + r.alto <= de.y + de.alto

const casos = (Object.keys(FORMATOS) as Formato[]).flatMap((formato) =>
  (['cartela', 'hud'] as const).map((tipo) => ({ formato, tipo })))

describe.each(casos)('$formato con $tipo', ({ formato, tipo }) => {
  const layout = layoutLamina(formato, tipo, true)
  const lienzo = { x: 0, y: 0, ...layout.lienzo }

  it('el lienzo tiene el tamaño del formato', () => {
    expect(layout.lienzo).toEqual({ ancho: FORMATOS[formato].ancho, alto: FORMATOS[formato].alto })
  })

  it('el mapa, el pie y la rosa quedan dentro del marco', () => {
    expect(dentro(layout.marco, lienzo)).toBe(true)
    expect(dentro(layout.mapa, layout.marco)).toBe(true)
    expect(dentro(layout.pie, layout.marco)).toBe(true)
    expect(dentro(layout.rosa!, layout.mapa)).toBe(true)
  })

  it('el pie va debajo del mapa, sin pisarlo', () => {
    expect(layout.pie.y).toBeGreaterThanOrEqual(layout.mapa.y + layout.mapa.alto)
  })

  it('los textos del pie van en orden y no se pisan', () => {
    const { titulo, subtitulo, leyenda, atribucion } = layout.textos
    expect(titulo.y - titulo.tam).toBeGreaterThanOrEqual(layout.pie.y)
    expect(subtitulo.y - subtitulo.tam).toBeGreaterThan(titulo.y)
    expect(leyenda.y - leyenda.tam).toBeGreaterThan(subtitulo.y)
    expect(atribucion.y - atribucion.tam).toBeGreaterThan(leyenda.y)
    expect(atribucion.y).toBeLessThanOrEqual(layout.pie.y + layout.pie.alto)
  })
})

it('sin rosa no se reserva lugar para ella', () => {
  expect(layoutLamina('cuadrado', 'hud', false).rosa).toBeNull()
})
