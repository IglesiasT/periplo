import { describe, expect, it } from 'vitest'
import css from '../index.css?raw'
import { TEMA_POR_DEFECTO, TEMAS, variablesCss } from '.'
import { atlas } from './atlas'

const usadas = [...new Set([...css.matchAll(/var\((--[a-z-]+)\)/g)].map((m) => m[1]))]

/** Luminancia relativa y contraste de WCAG, de colores `#rrggbb`. */
function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const canal = parseInt(hex.slice(i, i + 2), 16) / 255
    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (oscuro + 0.05)
}

/** Distancia entre dos colores en OKLab: ~0,02 es lo mínimo que el ojo separa. */
function distancia(a: string, b: string): number {
  const oklab = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const canal = parseInt(hex.slice(i, i + 2), 16) / 255
      return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4
    })
    const [l, m, s] = [
      0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
      0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
      0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
    ].map(Math.cbrt)
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ]
  }
  const [x, y] = [oklab(a), oklab(b)]
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

/** La distancia más chica entre dos colores cualesquiera de la lista. */
function menorDistancia(colores: string[]): number {
  return Math.min(...colores.flatMap((a, i) => colores.slice(i + 1).map((b) => distancia(a, b))))
}

describe.each(Object.values(TEMAS))('tema $id', (tema) => {
  it('define todas las variables que usa index.css', () => {
    const definidas = new Set(Object.keys(variablesCss(tema)))
    expect(usadas.filter((variable) => !definidas.has(variable))).toEqual([])
  })

  it('está registrado con su propio id', () => {
    expect(TEMAS[tema.id]).toBe(tema)
  })

  it('tiene al menos las 10 aguadas que reparte el backend entre vecinas (historia.CANTIDAD_TONOS)', () => {
    expect(tema.aguadas.length).toBeGreaterThanOrEqual(10)
  })

  it('el texto se lee sobre el papel', () => {
    const { papel, papelHondo, tinta, tenue, carminOscuro, activo, activoTexto } = tema.ui
    expect(contraste(tinta, papel)).toBeGreaterThanOrEqual(4.5)
    expect(contraste(tenue, papel)).toBeGreaterThanOrEqual(4.5)
    expect(contraste(tenue, papelHondo)).toBeGreaterThanOrEqual(4.5)
    expect(contraste(carminOscuro, papel)).toBeGreaterThanOrEqual(4.5)
    expect(contraste(activoTexto, activo)).toBeGreaterThanOrEqual(4.5)
  })

  it('lo visitado y los deseos se separan de la tierra sin visitar', () => {
    const { visitada, hogar, deseo } = tema.estados
    const tierra = tema.mapa.noVisitado
    expect(contraste(visitada, tierra)).toBeGreaterThanOrEqual(3)
    expect(contraste(hogar, tierra)).toBeGreaterThanOrEqual(3)
    expect(contraste(deseo, tierra)).toBeGreaterThanOrEqual(3)
  })

  describe('las aguadas de las épocas', () => {
    const entintadas = tema.aguadas.map(([entintada]) => entintada)
    const diluidas = tema.aguadas.map(([, diluida]) => diluida)

    it('no se confunden con lo visitado ni con el deseo', () => {
      for (const entintada of entintadas) {
        expect(distancia(entintada, tema.estados.visitada), entintada).toBeGreaterThanOrEqual(0.1)
        expect(distancia(entintada, tema.estados.deseo), entintada).toBeGreaterThanOrEqual(0.1)
      }
    })

    it('lo pisado se separa de lo no pisado de la misma entidad', () => {
      const minimo = tema.esquema === 'dark' ? 3.5 : 1.9
      for (const [entintada, diluida] of tema.aguadas) {
        expect(contraste(entintada, diluida), entintada).toBeGreaterThanOrEqual(minimo)
      }
    })

    it('lo no pisado se separa de la tierra sin visitar', () => {
      for (const diluida of diluidas) {
        expect(distancia(diluida, tema.mapa.noVisitado), diluida).toBeGreaterThanOrEqual(0.04)
      }
    })

    it('dos vecinas no se confunden', () => {
      expect(menorDistancia(entintadas)).toBeGreaterThanOrEqual(0.04)
      expect(menorDistancia(diluidas)).toBeGreaterThanOrEqual(0.02)
    })
  })

  it('el hogar no se confunde con lo visitado', () => {
    expect(distancia(tema.estados.hogar, tema.estados.visitada)).toBeGreaterThanOrEqual(0.15)
  })
})

it('el tema por defecto es el atlas', () => {
  expect(TEMA_POR_DEFECTO).toBe(atlas)
})

it('index.css no define colores propios: todos vienen del tema', () => {
  expect(css.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi)).toBeNull()
})

it('variablesCss pasa los nombres a guiones y suma las fuentes', () => {
  const variables = variablesCss(atlas)
  expect(variables['--papel-hondo']).toBe(atlas.ui.papelHondo)
  expect(variables['--carmin-oscuro']).toBe(atlas.ui.carminOscuro)
  expect(variables['--titulo']).toBe(atlas.fuentes.titulo)
  expect(variables['--radio-control']).toBe(atlas.forma.radioControl)
})
