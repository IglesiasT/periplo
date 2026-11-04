import { ETIQUETAS_NIVEL, ETIQUETAS_PRESENCIA } from '../etiquetas'
import { useActualizarVisita, useBorrarVisita } from '../hooks/consultas'
import type { TipoPresencia, Visita } from '../types'

interface Props {
  visitas: Visita[]
  onAviso: (aviso: string | null) => void
}

export default function VisitasLista({ visitas, onAviso }: Props) {
  const alFallar = { onError: (error: Error) => onAviso(error.message) }
  const actualizar = useActualizarVisita()
  const borrar = useBorrarVisita()

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
              {visita.realizada ? ETIQUETAS_PRESENCIA[visita.tipo_presencia] : 'Deseo'}
            </span>
          ) : (
            <div className="controles">
              <select
                value={visita.tipo_presencia}
                onChange={(e) =>
                  actualizar.mutate({ id: visita.id, datos: { tipo_presencia: e.target.value as TipoPresencia } }, alFallar)}
              >
                {Object.entries(ETIQUETAS_PRESENCIA).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>{etiqueta}</option>
                ))}
              </select>
              <label className="check">
                <input
                  type="checkbox"
                  checked={visita.realizada}
                  onChange={(e) => actualizar.mutate({ id: visita.id, datos: { realizada: e.target.checked } }, alFallar)}
                />
                fui
              </label>
              <button type="button" className="icono" title="Quitar" onClick={() => borrar.mutate(visita.id, alFallar)}>×</button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
