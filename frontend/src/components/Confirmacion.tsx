import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { type Confirmar, ContextoConfirmacion, type Pedido } from '../hooks/useConfirmar'

/** Un solo modal para toda la app, con el estilo del tema: reemplaza a window.confirm. */
export function ProveedorConfirmacion({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState<{ pedido: Pedido; responder: (si: boolean) => void } | null>(null)
  const dialogo = useRef<HTMLDialogElement>(null)

  const confirmar = useCallback<Confirmar>((pedido) => new Promise((resolver) => {
    setAbierto((anterior) => {
      anterior?.responder(false) // uno nuevo cancela al que quedara abierto
      return { pedido, responder: resolver }
    })
  }), [])

  useEffect(() => {
    if (abierto && !dialogo.current?.open) dialogo.current?.showModal()
  }, [abierto])

  const responder = (si: boolean) => {
    abierto?.responder(si)
    setAbierto(null)
    dialogo.current?.close()
  }

  return (
    <ContextoConfirmacion.Provider value={confirmar}>
      {children}
      {/* Escape dispara "cancel": cuenta como no. */}
      <dialog ref={dialogo} className="confirmacion" onCancel={() => responder(false)}
              aria-labelledby="confirmacion-titulo">
        {abierto && (
          <>
            <h2 id="confirmacion-titulo">{abierto.pedido.titulo}</h2>
            <p>{abierto.pedido.mensaje}</p>
            <div className="acciones">
              <button type="button" onClick={() => responder(false)} autoFocus>Cancelar</button>
              <button type="button" className="peligro" onClick={() => responder(true)}>{abierto.pedido.aceptar}</button>
            </div>
          </>
        )}
      </dialog>
    </ContextoConfirmacion.Provider>
  )
}
