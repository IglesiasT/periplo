import { type ReactNode, useLayoutEffect, useState } from 'react'
import { aplicarTema, TEMA_POR_DEFECTO, TEMAS } from '.'
import { ContextoTema } from './contexto'

// La elección se recuerda por navegador. Puede no haber localStorage (ventana privada, sitio bloqueado):
// entonces queda el tema por defecto y no pasa nada más.
const CLAVE = 'periplo.tema'

function leerGuardado(): string | null {
  try {
    return localStorage.getItem(CLAVE)
  } catch {
    return null
  }
}

function guardar(id: string) {
  try {
    localStorage.setItem(CLAVE, id)
  } catch {
    // sin almacenamiento: la elección dura lo que dura la pestaña
  }
}

export function ProveedorTema({ children }: { children: ReactNode }) {
  const [id, setId] = useState(() => leerGuardado() ?? TEMA_POR_DEFECTO.id)
  const tema = TEMAS[id] ?? TEMA_POR_DEFECTO
  // Antes de que el navegador pinte: sin un primer cuadro con los colores de otro tema.
  useLayoutEffect(() => aplicarTema(tema), [tema])

  const elegirTema = (nuevo: string) => {
    if (!TEMAS[nuevo]) return
    setId(nuevo)
    guardar(nuevo)
  }
  return (
    <ContextoTema.Provider value={{ tema, temas: Object.values(TEMAS), elegirTema }}>{children}</ContextoTema.Provider>
  )
}
