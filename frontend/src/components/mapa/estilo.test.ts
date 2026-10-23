import { describe, expect, it } from 'vitest'
import type { LayerSpecification } from 'maplibre-gl'
import type { Tema } from '../../tema'
import { atlas } from '../../tema/atlas'
import type { Epoca } from '../../types'
import { crearEstilo, rellenoHistorico, SOURCES } from './estilo'

const BASE = 'http://localhost:5173/'

const esColor = (texto: string) => /^(#[0-9a-f]{3,8}$|rgba?\(|hsla?\()/i.test(texto)

/** Una copia del tema con cada color reemplazado por uno distinto e inconfundible (#000001, #000002…):
 *  si el estilo usara un color propio, aparecería fuera de esta lista. */
function marcarColores<T>(valor: T, contador = { n: 0 }): T {
  if (typeof valor === 'string') {
    return (esColor(valor) ? `#${(++contador.n).toString(16).padStart(6, '0')}` : valor) as T
  }
  if (Array.isArray(valor)) return valor.map((v) => marcarColores(v, contador)) as T
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, marcarColores(v, contador)])) as T
  }
  return valor
}

function coloresDe(valor: unknown): string[] {
  return JSON.stringify(valor).match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g) ?? []
}

const estilo = crearEstilo(atlas, BASE)
const capas = estilo.layers
const ids = capas.map((capa) => capa.id)
const capa = (id: string) => capas.find((c) => c.id === id) as LayerSpecification & { source?: string }

// Que lo elegido en el panel se marque en el mapa es la función principal del proyecto.
describe('capas de resaltado', () => {
  it.each(SOURCES)('%s tiene halo y trazo, con el halo debajo, en cualquier zoom', (source) => {
    const halo = capa(`${source}-resaltada-halo`)
    const trazo = capa(`${source}-resaltada`)
    expect(halo).toBeDefined()
    expect(trazo).toBeDefined()
    expect(ids.indexOf(halo.id)).toBeLessThan(ids.indexOf(trazo.id))
    for (const c of [halo, trazo]) {
      expect(c.source).toBe(source)
      // Sin límites de zoom: una región elegida tiene que poder verse de lejos (ver resaltado.ts).
      expect(c.minzoom).toBeUndefined()
      expect(c.maxzoom).toBeUndefined()
      expect(JSON.stringify(c.paint)).toContain('resaltada')
    }
  })

  it('van encima de todo lo demás: rellenos, fronteras, rótulos y fotos', () => {
    const primero = ids.findIndex((id) => id.includes('-resaltada'))
    const ultimoOtro = ids.findLastIndex((id) => !id.includes('-resaltada'))
    expect(primero).toBeGreaterThan(ultimoOtro)
  })
})

it('ninguna capa usa patrones: el rayado de los deseos no vuelve', () => {
  expect(JSON.stringify(estilo)).not.toMatch(/pattern/)
})

it('las fuentes de los rótulos se resuelven contra la base', () => {
  for (const url of Object.values(estilo['font-faces'] ?? {})) expect(String(url).startsWith(BASE)).toBe(true)
})

describe('colores', () => {
  const marcado: Tema = marcarColores(atlas)
  const delTema = new Set(coloresDe(marcado))

  it('todos los colores del estilo salen del tema', () => {
    expect(coloresDe(crearEstilo(marcado, BASE)).filter((c) => !delTema.has(c))).toEqual([])
  })

  it('el relleno de una época usa la tierra y las aguadas del tema', () => {
    const epoca: Epoca = { anio: 1800, regiones: { 'AR-A': 'Spain', 'PE-CUS': 'Peru' }, colores: {}, nombres: {}, pisadas: [] }
    const relleno = rellenoHistorico(epoca, marcado)
    expect(coloresDe(relleno).filter((c) => !delTema.has(c))).toEqual([])
    expect(coloresDe(relleno)).toContain(marcado.mapa.noVisitado)
    expect(rellenoHistorico({ ...epoca, regiones: {} }, marcado)).toBe(marcado.mapa.noVisitado)
  })
})
