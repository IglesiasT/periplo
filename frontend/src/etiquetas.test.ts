import { describe, expect, it } from 'vitest'
import { ETIQUETAS_ESTADO, ETIQUETAS_ESTADO_VIAJE, etiquetaVisita, mensajeBorrarViaje } from './etiquetas'

describe('un deseo se llama igual en todos lados', () => {
  it('en el mapa, en los viajes y en las visitas', () => {
    expect(ETIQUETAS_ESTADO.deseo).toBe(ETIQUETAS_ESTADO_VIAJE.deseo)
    expect(etiquetaVisita({ realizada: false, tipo_presencia: 'estadia' })).toBe(ETIQUETAS_ESTADO.deseo)
  })

  it('una visita hecha dice su presencia', () => {
    expect(etiquetaVisita({ realizada: true, tipo_presencia: 'paso' })).toBe('De paso')
  })
})

describe('mensajeBorrarViaje', () => {
  it('avisa que también se van las fotos, porque es lo único que no se recupera', () => {
    const mensaje = mensajeBorrarViaje('NOA', 3, 2)
    expect(mensaje).toContain('"NOA"')
    expect(mensaje).toContain('3 regiones')
    expect(mensaje).toContain('2 fotos')
    expect(mensaje).toContain('del disco')
  })

  it('en singular', () => {
    const mensaje = mensajeBorrarViaje('NOA', 1, 1)
    expect(mensaje).toContain('con 1 región y 1 foto?')
  })

  it('sin fotos no las menciona', () => {
    const mensaje = mensajeBorrarViaje('NOA', 3, 0)
    expect(mensaje).toContain('3 regiones')
    expect(mensaje).not.toContain('foto')
  })

  it('sin nada adentro, solo el viaje', () => {
    expect(mensajeBorrarViaje('NOA', 0, 0)).toBe('¿Borrar "NOA"?')
  })
})
