import { describe, expect, it } from 'vitest'
import { leerVista } from './vista'

describe('leerVista', () => {
  it('lee zoom/lat/lon', () => {
    expect(leerVista('#6.87/-23.4170/-65.6449')).toEqual({ center: [-65.6449, -23.417], zoom: 6.87 })
  })

  it.each(['', '#', '#5', '#5/10', '#a/b/c', '#5//10', '#5/10/20/30', '#5/95/10', '#-1/10/10', '#Infinity/0/0'])(
    'rechaza %s',
    (hash) => {
      expect(leerVista(hash)).toBeNull()
    },
  )
})
