import { describe, expect, it } from 'vitest'
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec'
import type { LayerSpecification } from 'maplibre-gl'
import type { Tema } from '../../tema'
import { atlas } from '../../tema/atlas'
import type { Epoca } from '../../types'
import {
  capasConsultables, crearEstilo, type Lente, rellenoHistorico, rotulosComoGeoJSON, SOURCES, UMBRALES, visibilidadRotulos,
} from './estilo'

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
    const epoca: Epoca = {
      anio: 1800, regiones: { 'AR-A': 'Spain', 'PE-CUS': 'Peru' }, nombres: {}, pisadas: [], rotulos: [],
      tonos: {},
    }
    const relleno = rellenoHistorico(epoca, marcado)
    expect(coloresDe(relleno).filter((c) => !delTema.has(c))).toEqual([])
    expect(coloresDe(relleno)).toContain(marcado.mapa.noVisitado)
    expect(rellenoHistorico({ ...epoca, regiones: {} }, marcado)).toBe(marcado.mapa.noVisitado)
  })
})

const LENTES = Object.keys(UMBRALES) as Lente[]

/** Lo que tiene que coincidir entre lentes para que cambiar de una a otra no deje nada de la anterior. */
const forma = (capas: LayerSpecification[]) =>
  capas.map((c) => [c.id, Object.keys(c.paint ?? {}).sort(), Object.keys(('layout' in c && c.layout) || {}).sort(), 'filter' in c])

describe.each(LENTES)('lente %s', (lente) => {
  const estiloLente = crearEstilo(atlas, BASE, lente)

  it('es un estilo válido para MapLibre', () => {
    expect(validateStyleMin(estiloLente).map((error) => error.message)).toEqual([])
  })

  it('tiene las mismas capas y propiedades que las demás: solo cambian los valores', () => {
    expect(forma(estiloLente.layers)).toEqual(forma(estilo.layers))
  })

  it('el resaltado se ve en cualquier zoom', () => {
    for (const c of estiloLente.layers.filter((c) => c.id.includes('-resaltada'))) {
      expect([c.id, c.minzoom, c.maxzoom]).toEqual([c.id, undefined, undefined])
    }
  })

  it('los fundidos entre niveles no se pisan', () => {
    const { provincias, departamentos } = UMBRALES[lente]
    expect(departamentos - provincias).toBeGreaterThan(1)
  })

  it('no tiene colores fuera del tema', () => {
    const marcado: Tema = marcarColores(atlas)
    const delTema = new Set(coloresDe(marcado))
    expect(coloresDe(crearEstilo(marcado, BASE, lente)).filter((c) => !delTema.has(c))).toEqual([])
  })
})

describe('qué nivel muestra cada lente', () => {
  const zooms = (lente: Lente, id: string) => {
    const c = crearEstilo(atlas, BASE, lente).layers.find((c) => c.id === id)!
    return [c.minzoom ?? 0, c.maxzoom ?? 24]
  }

  it('automática: el zoom semántico de siempre', () => {
    expect(zooms('automatica', 'paises-relleno')).toEqual([0, 4.5])
    expect(zooms('automatica', 'provincias-relleno')).toEqual([3.5, 24])
    expect(zooms('automatica', 'departamentos-relleno')).toEqual([6.5, 24])
    expect(zooms('automatica', 'rotulos-provincias')).toEqual([4, 24])
    expect(zooms('automatica', 'rotulos-paises')).toEqual([0, 5.5])
  })

  it('países: nunca provincias ni departamentos', () => {
    expect(zooms('paises', 'paises-relleno')).toEqual([0, 24])
    expect(zooms('paises', 'provincias-relleno')[0]).toBe(24)
    expect(zooms('paises', 'departamentos-relleno')[0]).toBe(24)
    expect(zooms('paises', 'rotulos-provincias')[0]).toBe(24)
  })

  it('provincias: desde el zoom 0, sin países ni departamentos', () => {
    expect(zooms('provincias', 'provincias-relleno')).toEqual([0, 24])
    expect(zooms('provincias', 'paises-relleno')[1]).toBe(0)
    expect(zooms('provincias', 'departamentos-relleno')[0]).toBe(24)
    expect(zooms('provincias', 'rotulos-paises')[1]).toBe(0)
  })

  it('departamentos: desde el zoom 0, con provincias donde no hay departamentos', () => {
    expect(zooms('departamentos', 'departamentos-relleno')).toEqual([0, 24])
    expect(zooms('departamentos', 'provincias-relleno')).toEqual([0, 24])
  })

  it('las provincias no se rotulan lejos de todo, ni con la lente de provincias: serían miles', () => {
    expect(zooms('provincias', 'rotulos-provincias')[0]).toBe(2)
  })

  it('el hover y el click buscan la región del nivel que se ve', () => {
    expect(capasConsultables(2, 'automatica')).toEqual(['paises-relleno'])
    expect(capasConsultables(5, 'automatica')).toEqual(['provincias-relleno'])
    expect(capasConsultables(8, 'automatica')).toEqual(['departamentos-relleno', 'provincias-relleno'])
    expect(capasConsultables(10, 'paises')).toEqual(['paises-relleno'])
    expect(capasConsultables(1, 'provincias')).toEqual(['provincias-relleno'])
    expect(capasConsultables(1, 'departamentos')).toEqual(['departamentos-relleno', 'provincias-relleno'])
  })
})

describe('rótulos de la época', () => {
  const epoca: Epoca = {
    anio: 1815, regiones: {}, nombres: { 'United Provinces of the Río de la Plata': 'Provincias Unidas del Río de la Plata' },
    pisadas: [],
    rotulos: [
      { entidad: 'United Provinces of the Río de la Plata', lon: -62, lat: -30, area_km2: 3_000_000 },
      { entidad: 'Mapuche', lon: -71, lat: -39, area_km2: 200_000 },
    ],
    tonos: {},
  }

  it('el estilo tiene su source vacía y su capa, oculta hasta que se elige un año', () => {
    expect(estilo.sources['rotulos-epoca']).toBeDefined()
    expect(capa('rotulos-epoca').layout).toMatchObject({ visibility: 'none' })
  })

  it('con un año elegido se ocultan los nombres de hoy y se muestran los de la época', () => {
    expect(visibilidadRotulos(true)).toEqual({ 'rotulos-paises': 'none', 'rotulos-provincias': 'none', 'rotulos-epoca': 'visible' })
    expect(visibilidadRotulos(false)).toEqual({ 'rotulos-paises': 'visible', 'rotulos-provincias': 'visible', 'rotulos-epoca': 'none' })
  })

  it('cada entidad es un punto con su nombre en castellano si está traducido', () => {
    const { features } = rotulosComoGeoJSON(epoca)
    expect(features.map((f) => f.properties)).toEqual([
      { nombre: 'Provincias Unidas del Río de la Plata', area_km2: 3_000_000 },
      { nombre: 'Mapuche', area_km2: 200_000 },
    ])
    expect(features[0].geometry).toEqual({ type: 'Point', coordinates: [-62, -30] })
    expect(rotulosComoGeoJSON(undefined).features).toEqual([])
  })
})
