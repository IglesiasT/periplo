import { describe, expect, it } from 'vitest'
import css from '../index.css?raw'
import { TEMAS, variablesCss } from '.'
import { atlas } from './atlas'

const usadas = [...new Set([...css.matchAll(/var\((--[a-z-]+)\)/g)].map((m) => m[1]))]

describe.each(Object.values(TEMAS))('tema $id', (tema) => {
  it('define todas las variables que usa index.css', () => {
    const definidas = new Set(Object.keys(variablesCss(tema)))
    expect(usadas.filter((variable) => !definidas.has(variable))).toEqual([])
  })

  it('está registrado con su propio id', () => {
    expect(TEMAS[tema.id]).toBe(tema)
  })

  it('tiene aguadas para pintar las épocas', () => {
    expect(tema.aguadas.length).toBeGreaterThan(0)
  })
})

it('index.css no define colores propios: todos vienen del tema', () => {
  expect(css.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi)).toBeNull()
})

it('variablesCss pasa los nombres a guiones y suma las fuentes', () => {
  const variables = variablesCss(atlas)
  expect(variables['--papel-hondo']).toBe(atlas.ui.papelHondo)
  expect(variables['--carmin-oscuro']).toBe(atlas.ui.carminOscuro)
  expect(variables['--titulo']).toBe(atlas.fuentes.titulo)
})
