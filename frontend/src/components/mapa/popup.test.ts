import { describe, expect, it } from 'vitest'
import { htmlPopupFoto, htmlPopupRegion } from './popup'

const base = { nombre: 'Jujuy', detalle: 'Estadía', marcando: false, tieneFicha: false }

describe('htmlPopupRegion', () => {
  it('avisa que el click abre la ficha', () => {
    expect(htmlPopupRegion(base)).toContain('Click para abrir su ficha')
  })

  it('marca las regiones que ya tienen ficha', () => {
    const html = htmlPopupRegion({ ...base, tieneFicha: true })
    expect(html).toContain('✎')
    expect(html).not.toContain('abrir su ficha')
  })

  it('en modo de marcar el click marca, tenga ficha o no', () => {
    const html = htmlPopupRegion({ ...base, marcando: true, tieneFicha: true })
    expect(html).toContain('Click para marcar')
    expect(html).not.toContain('✎')
  })

  it('muestra la entidad solo en un año histórico', () => {
    expect(htmlPopupRegion({ ...base, entidad: 'Virreinato del Perú' })).toContain('<em>Virreinato del Perú</em>')
    expect(htmlPopupRegion(base).match(/<em>/g)).toHaveLength(1)
  })

  it('escapa los nombres', () => {
    const html = htmlPopupRegion({ ...base, nombre: '<img src=x>', entidad: 'A & B' })
    expect(html).not.toContain('<img')
    expect(html).not.toContain('A & B')
  })
})

describe('htmlPopupFoto', () => {
  it('escapa las rutas y el detalle', () => {
    expect(htmlPopupFoto('/a".jpg', '/b.jpg', '<x>')).not.toMatch(/a"|<x>/)
  })
})
