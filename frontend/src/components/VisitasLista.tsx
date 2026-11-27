import { ETIQUETAS_NIVEL, etiquetaVisita } from '../etiquetas'
import { useActualizarVisita, useBorrarVisita } from '../hooks/consultas'
import type { Visita } from '../types'
import { useConfirmar } from '../hooks/useConfirmar'

interface Props {
  visitas: Visita[]
  onAviso: (aviso: string | null) => void
}

export default function VisitasLista({ visitas, onAviso }: Props) {
  const alFallar = { onError: (error: Error) => onAviso(error.message) }
  const actualizar = useActualizarVisita()
  const borrar = useBorrarVisita()
  const confirmar = useConfirmar()

  // Sacar un deseo no pierde nada; sacar algo visitado, sí: que no pase por un descuido.
  const quitar = async (visita: Visita) => {
    if (visita.realizada && !(await confirmar({
      titulo: `¿Quitar ${visita.region_nombre} del viaje?`,
      mensaje: 'Se pierde que fuiste ahí en este viaje. Si es una corrección del mapa, mejor marcala desde su ficha.',
      aceptar: 'Quitar',
    }))) return
    borrar.mutate(visita.id, alFallar)
  }

  if (!visitas.length) {
    return <p className="vacio">Todavía no tiene regiones.</p>
  }

  return (
    <ul className="visitas">
      {visitas.map((visita) => (
        <li key={visita.id}>
          <div>
            <strong>{visita.region_nombre}</strong>{' '}
            <span className="tenue">{ETIQUETAS_NIVEL[visita.region_nivel]}</span>
            {visita.desde_notion && <span className="etiqueta">Notion</span>}
          </div>
          {visita.desde_notion ? (
            <span className="tenue">
              {etiquetaVisita(visita)}
            </span>
          ) : (
            <div className="controles">
              <label className="check">
                <input
                  type="checkbox"
                  checked={visita.realizada}
                  onChange={(e) => actualizar.mutate({ id: visita.id, datos: { realizada: e.target.checked } }, alFallar)}
                />
                fui
              </label>
              <button type="button" className="icono" title="Quitar" onClick={() => quitar(visita)}>×</button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
