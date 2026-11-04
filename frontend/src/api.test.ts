import { describe, expect, it } from 'vitest'
import { ErrorApi, reintentar } from './api'

describe('reintentar', () => {
  it('no insiste con lo que el servidor rechazó: una región que no existe no va a aparecer', () => {
    expect(reintentar(0, new ErrorApi(404, null))).toBe(false)
    expect(reintentar(0, new ErrorApi(400, null))).toBe(false)
  })

  it('insiste con los errores del servidor y de la red, hasta tres veces', () => {
    expect(reintentar(0, new ErrorApi(502, null))).toBe(true)
    expect(reintentar(2, new TypeError('Failed to fetch'))).toBe(true)
    expect(reintentar(3, new ErrorApi(502, null))).toBe(false)
  })
})
