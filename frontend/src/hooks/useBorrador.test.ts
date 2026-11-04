import { afterEach, describe, expect, it, vi } from 'vitest'
import { escribirBorrador, leerBorrador } from './useBorrador'

function almacenamientoFalso() {
  const datos = new Map<string, string>()
  return {
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => void datos.set(clave, valor),
    removeItem: (clave: string) => void datos.delete(clave),
  }
}

describe('borradores', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('se guardan por clave y null los borra', () => {
    vi.stubGlobal('localStorage', almacenamientoFalso())
    escribirBorrador('ficha.AR-Y', 'Tilcara')
    escribirBorrador('ficha.AR-A', 'Cafayate')
    expect(leerBorrador('ficha.AR-Y')).toBe('Tilcara')
    escribirBorrador('ficha.AR-Y', null)
    expect(leerBorrador('ficha.AR-Y')).toBeNull()
    expect(leerBorrador('ficha.AR-A')).toBe('Cafayate')
  })

  it('conserva un texto vacío: vaciar una ficha es un borrador, no la falta de uno', () => {
    vi.stubGlobal('localStorage', almacenamientoFalso())
    escribirBorrador('ficha.AR-Y', '')
    expect(leerBorrador('ficha.AR-Y')).toBe('')
  })

  it('sin almacenamiento no rompe', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('bloqueado') },
      setItem: () => { throw new Error('lleno') },
      removeItem: () => { throw new Error('bloqueado') },
    })
    expect(() => escribirBorrador('ficha.AR-Y', 'x')).not.toThrow()
    expect(leerBorrador('ficha.AR-Y')).toBeNull()
  })

  it('un valor corrupto cuenta como que no hay borrador', () => {
    vi.stubGlobal('localStorage', { ...almacenamientoFalso(), getItem: () => '{roto' })
    expect(leerBorrador('ficha.AR-Y')).toBeNull()
  })
})
