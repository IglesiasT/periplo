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

describe('el mensaje de un ErrorApi', () => {
  it('usa el detalle si lo hay', () => {
    expect(new ErrorApi(403, { detail: 'Viene de Notion.' }).message).toBe('Viene de Notion.')
  })

  it('usa el error general de la validación', () => {
    const error = new ErrorApi(400, { non_field_errors: ['Los campos viaje, region deben formar un conjunto único.'] })
    expect(error.message).toBe('Los campos viaje, region deben formar un conjunto único.')
  })

  it('si no, el error del primer campo', () => {
    const error = new ErrorApi(400, { fecha_fin: ['No puede ser anterior a la fecha de inicio.'] })
    expect(error.message).toBe('No puede ser anterior a la fecha de inicio.')
    expect(error.campos.fecha_fin).toEqual(['No puede ser anterior a la fecha de inicio.'])
  })

  it('sin nada legible, el estado', () => {
    expect(new ErrorApi(500, null).message).toBe('La API respondió 500')
    expect(new ErrorApi(400, {}).message).toBe('La API respondió 400')
  })
})
