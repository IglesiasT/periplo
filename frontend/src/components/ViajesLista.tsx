import { useState } from 'react'
import { ETIQUETAS_ESTADO_VIAJE, rangoFechas } from '../etiquetas'
import type { Viaje } from '../types'

type Filtro = 'todos' | 'hechos' | 'planes'

const FILTROS: Record<Filtro, { nombre: string; incluye: (viaje: Viaje) => boolean }> = {
  todos: { nombre: 'Todos', incluye: () => true },
  hechos: { nombre: 'Hechos', incluye: (v) => v.estado === 'hecho' },
  planes: { nombre: 'Planes', incluye: (v) => v.estado !== 'hecho' },
}

interface Props {
  viajes: Viaje[] | undefined
  cargando: boolean
  error: Error | null
  onElegir: (id: number) => void
  onNuevo: () => void
}

export default function ViajesLista({ viajes, cargando, error, onElegir, onNuevo }: Props) {
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const visibles = viajes?.filter(FILTROS[filtro].incluye) ?? []
  return (
    <>
      <div className="encabezado-seccion">
        <div className="filtros">
          {(Object.keys(FILTROS) as Filtro[]).map((f) => (
            <button key={f} className={f === filtro ? 'activa' : ''} onClick={() => setFiltro(f)}>
              {FILTROS[f].nombre}
            </button>
          ))}
        </div>
        <button onClick={onNuevo}>+ Viaje</button>
      </div>

      {cargando && <p className="vacio">Cargando…</p>}
      {error && <p className="error">No se pudieron cargar los viajes: {error.message}</p>}

      <ul className="viajes">
        {visibles.map((v) => (
          <li key={v.id}>
            <button onClick={() => onElegir(v.id)}>
              <span className={v.estado === 'hecho' ? 'marca marca-hecho' : 'marca marca-plan'} aria-hidden="true" />
              <span className="viaje-texto">
                <strong>{v.nombre}</strong>
                <span className="tenue">
                  {[ETIQUETAS_ESTADO_VIAJE[v.estado], rangoFechas(v.fecha_inicio, v.fecha_fin),
                    v.visitas.length ? `${v.visitas.length} ${v.visitas.length === 1 ? 'región' : 'regiones'}`
                      : 'sin regiones aún']
                    .filter(Boolean).join(' · ')}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
