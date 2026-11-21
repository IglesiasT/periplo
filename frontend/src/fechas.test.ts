import { describe, expect, it } from 'vitest'
import { enmascarar, isoATexto, mesAnio, rangoMeses, textoAIso } from './fechas'

describe('cuándo fue un viaje se dice al mes', () => {
  it('un viaje dentro de un mes', () => {
    expect(rangoMeses('2026-01-15', '2026-01-24')).toBe('Enero 2026')
  })

  it('entre dos meses del mismo año, el año va una vez', () => {
    expect(rangoMeses('2026-05-30', '2026-06-02')).toBe('Mayo – Junio 2026')
  })

  it('entre dos años, cada mes con el suyo', () => {
    expect(rangoMeses('2025-12-28', '2026-01-03')).toBe('Diciembre 2025 – Enero 2026')
  })

  it('con una sola fecha, o ninguna', () => {
    expect(rangoMeses('2026-01-15', null)).toBe('Enero 2026')
    expect(rangoMeses(null, '2026-01-15')).toBe('Enero 2026')
    expect(rangoMeses(null, null)).toBe('')
    expect(mesAnio(null)).toBe('')
  })
})

describe('el campo de fecha se escribe día/mes/año', () => {
  it('va y vuelve del ISO', () => {
    expect(isoATexto('2026-01-15')).toBe('15/01/2026')
    expect(textoAIso('15/01/2026')).toBe('2026-01-15')
    expect(isoATexto(null)).toBe('')
  })

  it('una fecha incompleta o que no existe no vale', () => {
    expect(textoAIso('15/01/20')).toBeNull()
    expect(textoAIso('31/02/2026')).toBeNull()
    expect(textoAIso('15/13/2026')).toBeNull()
    expect(textoAIso('29/02/2024')).toBe('2024-02-29')
  })

  it('las barras se ponen solas', () => {
    expect(enmascarar('15')).toBe('15')
    expect(enmascarar('150')).toBe('15/0')
    expect(enmascarar('15012026')).toBe('15/01/2026')
    expect(enmascarar('15/01/2026999')).toBe('15/01/2026')
  })
})
