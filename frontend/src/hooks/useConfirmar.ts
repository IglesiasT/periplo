import { createContext, useContext } from 'react'

/** Lo que se pregunta antes de pisar o borrar algo. */
export interface Pedido {
  titulo: string
  mensaje: string
  /** El botón que sigue adelante: "Borrar", "Marcar igual". */
  aceptar: string
}

export type Confirmar = (pedido: Pedido) => Promise<boolean>

/** Lo provee <ProveedorConfirmacion> (components/Confirmacion.tsx). */
export const ContextoConfirmacion = createContext<Confirmar | null>(null)

/** Devuelve `confirmar(pedido)`: abre el modal y resuelve en true si se acepta, false si se cancela o se cierra. */
export function useConfirmar(): Confirmar {
  const confirmar = useContext(ContextoConfirmacion)
  if (!confirmar) throw new Error('useConfirmar va dentro de <ProveedorConfirmacion>.')
  return confirmar
}
