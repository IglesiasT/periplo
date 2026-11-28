import { describe, expect, it } from 'vitest'
import { htmlPopupEntidad, htmlPopupFoto, htmlPopupRegion } from './popup'

const base = { nombre: 'Jujuy', detalle: 'Visitada', marcando: false, tieneFicha: false }

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

  it('lleva la bandera del país solo si la tiene', () => {
    expect(htmlPopupRegion({ ...base, bandera: '/banderas/ARG.svg' })).toContain('<img class="bandera" src="/banderas/ARG.svg"')
    expect(htmlPopupRegion({ ...base, bandera: null })).not.toContain('<img')
  })

  it('escapa los nombres', () => {
    const html = htmlPopupRegion({ ...base, nombre: '<img src=x>', entidad: 'A & B' })
    expect(html).not.toContain('<img')
    expect(html).not.toContain('A & B')
  })
})

describe('htmlPopupEntidad', () => {
  it('nombra solo la entidad, sin bandera, y dice si la pisé', () => {
    const html = htmlPopupEntidad({ nombre: 'Yugoslavia', pisada: false, marcando: false })
    expect(html).toContain('<strong>Yugoslavia</strong>')
    expect(html).toContain('Sin pisar')
    expect(html).not.toContain('<img')
    expect(htmlPopupEntidad({ nombre: 'Yugoslavia', pisada: true, marcando: false })).toContain('Pisaste su territorio')
  })

  it('escapa el nombre', () => {
    expect(htmlPopupEntidad({ nombre: '<b>', pisada: false, marcando: true })).not.toContain('<b>')
  })
})

describe('htmlPopupFoto', () => {
  it('escapa las rutas y el detalle', () => {
    expect(htmlPopupFoto('/a".jpg', '/b.jpg', '<x>')).not.toMatch(/a"|<x>/)
  })
})
