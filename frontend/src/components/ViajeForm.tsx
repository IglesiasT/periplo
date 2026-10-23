import { useState, type FormEvent } from 'react'
import { ErrorApi } from '../api'
import { ETIQUETAS_ESTADO_VIAJE } from '../etiquetas'
import { useBorrarViaje, useGuardarViaje } from '../hooks/consultas'
import type { DatosViaje, EstadoViaje, Viaje } from '../types'

const VACIO: DatosViaje = { nombre: '', estado: 'hecho', fecha_inicio: null, fecha_fin: null, notas: '' }

interface Props {
  /** Sin viaje, el formulario crea uno nuevo. */
  viaje?: Viaje
  onGuardado?: (viaje: Viaje) => void
  onBorrado?: () => void
}

export default function ViajeForm({ viaje, onGuardado, onBorrado }: Props) {
  // Formulario controlado: el estado de React es la fuente de verdad de cada input.
  const [datos, setDatos] = useState<DatosViaje>(() =>
    viaje
      ? { nombre: viaje.nombre, estado: viaje.estado, fecha_inicio: viaje.fecha_inicio,
          fecha_fin: viaje.fecha_fin, notas: viaje.notas }
      : VACIO,
  )
  const guardar = useGuardarViaje()
  const borrar = useBorrarViaje()
  const deNotion = Boolean(viaje?.notion_id)
  const errores = guardar.error instanceof ErrorApi ? guardar.error.campos : {}

  const cambiar = <K extends keyof DatosViaje>(campo: K, valor: DatosViaje[K]) => {
    guardar.reset()
    setDatos((anterior) => ({ ...anterior, [campo]: valor }))
  }

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    guardar.mutate({ id: viaje?.id, datos }, { onSuccess: (guardado) => onGuardado?.(guardado) })
  }

  const eliminar = () => {
    if (viaje && window.confirm(`¿Borrar "${viaje.nombre}" y sus visitas?`)) {
      borrar.mutate(viaje.id, { onSuccess: () => onBorrado?.() })
    }
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      {deNotion && <p className="aviso">Viene de Notion: el nombre y el estado se editan allá.</p>}

      <label>
        Nombre
        <input value={datos.nombre} required disabled={deNotion} onChange={(e) => cambiar('nombre', e.target.value)} />
        <Error mensajes={errores.nombre} />
      </label>

      <label>
        Estado
        <select value={datos.estado} disabled={deNotion}
                onChange={(e) => cambiar('estado', e.target.value as EstadoViaje)}>
          {Object.entries(ETIQUETAS_ESTADO_VIAJE).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>{etiqueta}</option>
          ))}
        </select>
        <Error mensajes={errores.estado} />
      </label>

      <div className="fila">
        <label>
          Desde
          <input type="date" value={datos.fecha_inicio ?? ''}
                 onChange={(e) => cambiar('fecha_inicio', e.target.value || null)} />
        </label>
        <label>
          Hasta
          <input type="date" value={datos.fecha_fin ?? ''}
                 onChange={(e) => cambiar('fecha_fin', e.target.value || null)} />
        </label>
      </div>
      <Error mensajes={errores.fecha_fin} />

      <label>
        Notas
        <textarea rows={4} value={datos.notas} onChange={(e) => cambiar('notas', e.target.value)} />
      </label>

      {guardar.error && !(guardar.error instanceof ErrorApi && Object.keys(errores).length) && (
        <Error mensajes={[guardar.error.message]} />
      )}

      <div className="acciones">
        <button type="submit" disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : viaje ? 'Guardar' : 'Crear viaje'}
        </button>
        {guardar.isSuccess && <span className="ok">Guardado</span>}
        {viaje && !deNotion && (
          <button type="button" className="peligro" onClick={eliminar} disabled={borrar.isPending}>Borrar</button>
        )}
      </div>
    </form>
  )
}

function Error({ mensajes }: { mensajes?: string[] }) {
  return mensajes?.length ? <span className="error">{mensajes.join(' ')}</span> : null
}
