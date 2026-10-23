import { useState } from 'react'
import { ETIQUETAS_ESTADO_VIAJE, rangoFechas } from '../etiquetas'
import type { Viaje } from '../types'
import ViajeForm from './ViajeForm'
import VisitasLista from './VisitasLista'

export type Seleccion = number | 'nuevo' | null

type Filtro = 'todos' | 'hechos' | 'planes'

const FILTROS: Record<Filtro, (viaje: Viaje) => boolean> = {
  todos: () => true,
  hechos: (v) => v.estado === 'hecho',
  planes: (v) => v.estado !== 'hecho',
}

interface Props {
  viajes: Viaje[] | undefined
  cargando: boolean
  error: Error | null
  seleccion: Seleccion
  onSeleccionar: (seleccion: Seleccion) => void
  /** Modo edición: los clicks en el mapa marcan regiones del viaje elegido. */
  editando: boolean
  onEditar: (editando: boolean) => void
  aviso: string | null
}

export default function Panel({
  viajes, cargando, error, seleccion, onSeleccionar, editando, onEditar, aviso,
}: Props) {
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const viaje = typeof seleccion === 'number' ? viajes?.find((v) => v.id === seleccion) : undefined

  if (seleccion === 'nuevo') {
    return (
      <aside className="panel">
        <button className="volver" onClick={() => onSeleccionar(null)}>← Viajes</button>
        <h2>Nuevo viaje</h2>
        <ViajeForm onGuardado={(nuevo) => onSeleccionar(nuevo.id)} />
      </aside>
    )
  }

  if (viaje) {
    return (
      <aside className="panel">
        <button className="volver" onClick={() => onSeleccionar(null)}>← Viajes</button>
        <h2>{viaje.nombre}</h2>
        {/* key: si cambia el viaje elegido, el formulario se vuelve a montar con sus datos. */}
        <ViajeForm key={viaje.id} viaje={viaje} onBorrado={() => onSeleccionar(null)} />
        <div className="encabezado-seccion">
          <h3>Regiones</h3>
          <button className={editando ? 'activa' : ''} onClick={() => onEditar(!editando)}>
            {editando ? 'Listo' : 'Marcar en el mapa'}
          </button>
        </div>
        {editando && (
          <p className="aviso">
            Hacé click en una región. Cada click avanza: estadía → de paso → tránsito → deseo → sin marcar.
            Marca el nivel que estás viendo: país, provincia o departamento.
          </p>
        )}
        {aviso && <p className="error">{aviso}</p>}
        <VisitasLista visitas={viaje.visitas} />
      </aside>
    )
  }

  const visibles = viajes?.filter(FILTROS[filtro]) ?? []
  return (
    <aside className="panel">
      <header className="encabezado">
        <h1>Periplo</h1>
        <button onClick={() => onSeleccionar('nuevo')}>+ Viaje</button>
      </header>

      <div className="pestanias">
        {(Object.keys(FILTROS) as Filtro[]).map((f) => (
          <button key={f} className={f === filtro ? 'activa' : ''} onClick={() => setFiltro(f)}>
            {{ todos: 'Todos', hechos: 'Hechos', planes: 'Planes' }[f]}
          </button>
        ))}
      </div>

      {cargando && <p className="vacio">Cargando…</p>}
      {error && <p className="error">No se pudieron cargar los viajes: {error.message}</p>}

      <ul className="viajes">
        {visibles.map((v) => (
          <li key={v.id}>
            <button onClick={() => onSeleccionar(v.id)}>
              <strong>{v.nombre}</strong>
              <span className="tenue">
                {[ETIQUETAS_ESTADO_VIAJE[v.estado], rangoFechas(v.fecha_inicio, v.fecha_fin),
                  `${v.visitas.length} ${v.visitas.length === 1 ? 'región' : 'regiones'}`]
                  .filter(Boolean).join(' · ')}
              </span>
              {v.notion_id && <span className="etiqueta">Notion</span>}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
