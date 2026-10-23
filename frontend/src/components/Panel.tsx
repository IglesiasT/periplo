import { useState } from 'react'
import { ETIQUETAS_ESTADO_VIAJE, rangoFechas } from '../etiquetas'
import type { Viaje } from '../types'
import Estadisticas from './Estadisticas'
import RutasLista from './RutasLista'
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
  /** Qué hacen los clicks en el mapa: nada especial, marcar regiones o dibujar una ruta del viaje elegido. */
  modo: Modo
  onCambiarModo: (modo: Modo) => void
  /** Resultado o error de la última acción sobre el mapa. */
  aviso: string | null
  onAviso: (aviso: string | null) => void
}

export type Modo = 'ninguno' | 'marcar' | 'dibujar'

export default function Panel({
  viajes, cargando, error, seleccion, onSeleccionar, modo, onCambiarModo, aviso, onAviso,
}: Props) {
  const alternar = (m: Modo) => onCambiarModo(modo === m ? 'ninguno' : m)
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
        {aviso && <p className="aviso-accion">{aviso}</p>}

        <div className="encabezado-seccion">
          <h3>Regiones</h3>
          <button className={modo === 'marcar' ? 'activa' : ''} onClick={() => alternar('marcar')}>
            {modo === 'marcar' ? 'Listo' : 'Marcar en el mapa'}
          </button>
        </div>
        {modo === 'marcar' && (
          <p className="aviso">
            Hacé click en una región. Cada click avanza: estadía → de paso → tránsito → deseo → sin marcar.
            Marca el nivel que estás viendo: país, provincia o departamento.
          </p>
        )}
        <VisitasLista visitas={viaje.visitas} />

        <RutasLista viaje={viaje} dibujando={modo === 'dibujar'} onDibujar={() => alternar('dibujar')}
                    onAviso={onAviso} />
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

      <Estadisticas />

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
