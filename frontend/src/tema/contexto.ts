import { createContext, useContext } from 'react'
import type { Tema } from './tipos'

export interface ValorTema {
  tema: Tema
  temas: Tema[]
  elegirTema: (id: string) => void
}

export const ContextoTema = createContext<ValorTema | null>(null)

/** El tema activo, los disponibles y cómo cambiarlo. Lo provee <ProveedorTema>. */
export function useTema(): ValorTema {
  const valor = useContext(ContextoTema)
  if (!valor) throw new Error('useTema necesita estar dentro de <ProveedorTema>.')
  return valor
}
