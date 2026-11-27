import { describe, expect, it } from 'vitest'
import { atlas } from '../tema/atlas'
import type { Epoca, Estadisticas, Viaje, Visita } from '../types'
import {
  codigosParaEncuadre, codigosVisitados, contenidoLamina, encuadrePorDefecto, nombreArchivo, ocultarHogar, zoomParaLamina,
} from './contenido'

const estadisticas = {
  paises_visitados: 12, paises_total: 195, continentes_visitados: 3, continentes_total: 6,
} as Estadisticas

const visita = (region: string, realizada = true) => ({ region, realizada }) as Visita
const viaje = {
  nombre: 'Norte argentino', fecha_inicio: '2024-03-02', fecha_fin: '2024-03-20',
  visitas: [visita('AR-Y'), visita('AR-A'), visita('AR-Y'), visita('AR-T', false)],
} as Viaje

const epoca = (pisadas: string[]): Epoca => ({
  anio: 1815, regiones: {}, nombres: { 'Spanish Empire': 'Imperio español' }, rotulos: [], tonos: {},
  pisadas: pisadas.map((entidad) => ({ entidad, regiones: [] })),
})

describe('contenidoLamina', () => {
  it('sin nada elegido: el título del tema y las cifras', () => {
    const c = contenidoLamina({ tema: atlas, estadisticas, mostrarHogar: true })
    expect(c.titulo).toBe(atlas.voz.tituloLamina)
    expect(c.subtitulo).toBe('12 de 195 países · 3 de 6 continentes')
    expect(c.atribucion).toContain('Instituto Geográfico Nacional')
  })

  it('con un viaje: su nombre, cuándo y cuántos lugares distintos se visitaron', () => {
    const c = contenidoLamina({ tema: atlas, viaje, estadisticas, mostrarHogar: true })
    expect(c.titulo).toBe('Norte argentino')
    expect(c.subtitulo).toBe('Marzo 2024 · 2 lugares')
  })

  it('con un año: la época, las entidades pisadas y sus colores en la leyenda', () => {
    const c = contenidoLamina({ tema: atlas, epoca: epoca(['Spanish Empire', 'Portugal']), mostrarHogar: true })
    expect(c.titulo).toBe('1815 · Era de las revoluciones')
    expect(c.subtitulo).toBe('Pisé territorio de 2 entidades')
    expect(c.leyenda.map((i) => i.etiqueta)).toEqual(['Imperio español', 'Portugal'])
    expect(c.atribucion).toContain('historical-basemaps')
  })

  it('el año le gana al viaje elegido, como en el mapa', () => {
    expect(contenidoLamina({ tema: atlas, viaje, epoca: epoca([]), mostrarHogar: true }).subtitulo)
      .toBe('No pisé territorio de ninguna entidad del mapa')
  })

  it('el hogar oculto no aparece en la leyenda', () => {
    const etiquetas = (mostrarHogar: boolean) =>
      contenidoLamina({ tema: atlas, mostrarHogar }).leyenda.map((i) => i.etiqueta)
    expect(etiquetas(true)).toContain('Hogar')
    expect(etiquetas(false)).not.toContain('Hogar')
    expect(etiquetas(false)).toContain('Sin visitar')
  })

  it('el deseo va como contorno, igual que en el mapa', () => {
    const deseo = contenidoLamina({ tema: atlas, mostrarHogar: true }).leyenda.find((i) => i.etiqueta === 'Deseo')
    expect(deseo?.contorno).toBe(true)
  })
})

it('ocultarHogar lo pinta como visitado y deja el resto', () => {
  expect(ocultarHogar({ 'AR-C': 'hogar', 'AR-Y': 'visitada', JPN: 'deseo' }))
    .toEqual({ 'AR-C': 'visitada', 'AR-Y': 'visitada', JPN: 'deseo' })
})

it('codigosVisitados deja afuera los deseos', () => {
  expect(codigosVisitados({ 'AR-C': 'hogar', JPN: 'deseo', 'AR-Y': 'visitada' })).toEqual(['AR-C', 'AR-Y'])
})

it('zoomParaLamina sube un nivel si la lámina es el doble de ancha', () => {
  expect(zoomParaLamina(3, 500, 1000)).toBeCloseTo(4)
  expect(zoomParaLamina(3, 1000, 1000)).toBe(3)
  expect(zoomParaLamina(3, 0, 1000)).toBe(3)
})

it('nombreArchivo saca acentos y no repite el nombre del proyecto', () => {
  const hoy = new Date(2026, 10, 26)
  expect(nombreArchivo('Norte argentino', hoy)).toBe('periplo-norte-argentino-2026-11-26.png')
  expect(nombreArchivo('Bitácora orbital', hoy)).toBe('periplo-bitacora-orbital-2026-11-26.png')
  expect(nombreArchivo('Mi periplo', hoy)).toBe('mi-periplo-2026-11-26.png')
  expect(nombreArchivo('> registro de viajes', hoy)).toBe('periplo-registro-de-viajes-2026-11-26.png')
})

describe('encuadre', () => {
  const estados = { 'AR-C': 'hogar', JPN: 'deseo', 'AR-Y': 'visitada' } as const

  it('con un viaje elegido, la lámina encuadra el viaje; sin viaje, copia la pantalla', () => {
    expect(encuadrePorDefecto(viaje)).toBe('viaje')
    expect(encuadrePorDefecto(undefined)).toBe('vista')
  })

  it('el viaje entero son sus regiones, sin repetir y aunque falte ir a alguna', () => {
    expect(codigosParaEncuadre('viaje', viaje, estados)).toEqual(['AR-A', 'AR-T', 'AR-Y'])
  })

  it('todo lo visitado deja afuera los deseos', () => {
    expect(codigosParaEncuadre('visitado', undefined, estados)).toEqual(['AR-C', 'AR-Y'])
  })

  it('sin nada que encuadrar se copia la pantalla', () => {
    expect(codigosParaEncuadre('vista', viaje, estados)).toBeNull()
    expect(codigosParaEncuadre('viaje', undefined, estados)).toBeNull()
    expect(codigosParaEncuadre('visitado', undefined, { JPN: 'deseo' })).toBeNull()
  })
})
