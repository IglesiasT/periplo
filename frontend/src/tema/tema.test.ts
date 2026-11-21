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
    const { visitada, deseo } = tema.estados
    const tierra = tema.mapa.noVisitado
    expect(contraste(visitada, tierra)).toBeGreaterThanOrEqual(3)
    expect(contraste(deseo, tierra)).toBeGreaterThanOrEqual(3)
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
