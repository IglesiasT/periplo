import { useState } from 'react'
import { ETIQUETAS_ESTADO_VIAJE, rangoFechas } from '../etiquetas'
import type { Foto, Logro, Viaje } from '../types'
import Estadisticas from './Estadisticas'
import FotosLista from './FotosLista'
import { LogrosLista, LogrosResumen } from './Logros'
import RutasLista from './RutasLista'
import ViajeForm from './ViajeForm'
import VisitasLista from './VisitasLista'

export type Seleccion = number | 'nuevo' | 'logros' | null

type Filtro = 'todos' | 'hechos' | 'planes'

const FILTROS: Record<Filtro, (viaje: Viaje) => boolean> = {
  todos: () => true,
  hechos: (v) => v.estado === 'hecho',
  planes: (v) => v.estado !== 'hecho',
}

interface Props {
  viajes: Viaje[] | undefined
  fotos: Foto[] | undefined
  logros: Logro[] | undefined
  cargando: boolean
  error: Error | null
  seleccion: Seleccion
  onSeleccionar: (seleccion: Seleccion) => void
  /** Logro desplegado en la vista de logros: sus regiones se resaltan en el mapa. */
  logroElegido: string | null
  onElegirLogro: (id: string | null) => void
  /** Qué hacen los clicks en el mapa: nada especial, marcar regiones o dibujar una ruta del viaje elegido. */
  modo: Modo
  onCambiarModo: (modo: Modo) => void
  /** Resultado o error de la última acción sobre el mapa. */
  aviso: string | null
  onAviso: (aviso: string | null) => void
}

export type Modo = 'ninguno' | 'marcar' | 'dibujar'

export default function Panel({
  viajes, fotos, logros, cargando, error, seleccion, onSeleccionar, logroElegido, onElegirLogro,
  modo, onCambiarModo, aviso, onAviso,
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

  if (seleccion === 'logros') {
    const completos = logros?.filter((l) => l.completo).length ?? 0
    return (
      <aside className="panel">
        <button className="volver" onClick={() => onSeleccionar(null)}>← Viajes</button>
        <h2>Logros</h2>
        <p className="cursiva">
          {completos} de {logros?.length ?? 0} sellados. Elegí uno para ver sus regiones en el mapa.
        </p>
        {logros ? <LogrosLista logros={logros} elegido={logroElegido} onElegir={onElegirLogro} />
          : <p className="vacio">Cargando…</p>}
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

        <FotosLista viaje={viaje} fotos={fotos?.filter((f) => f.viaje === viaje.id) ?? []} onAviso={onAviso} />
      </aside>
    )
  }

  const visibles = viajes?.filter(FILTROS[filtro]) ?? []
  return (
    <aside className="panel">
      <header className="encabezado">
        <div>
          <h1>Periplo</h1>
          <p className="lema">Atlas y diario de viajes</p>
        </div>
        <button onClick={() => onSeleccionar('nuevo')}>+ Viaje</button>
      </header>

      <Estadisticas />

      {logros && <LogrosResumen logros={logros} onVerTodos={() => onSeleccionar('logros')} />}

      <div className="encabezado-seccion">
        <h3>Viajes</h3>
        <div className="pestanias">
          {(Object.keys(FILTROS) as Filtro[]).map((f) => (
            <button key={f} className={f === filtro ? 'activa' : ''} onClick={() => setFiltro(f)}>
              {{ todos: 'Todos', hechos: 'Hechos', planes: 'Planes' }[f]}
            </button>
          ))}
        </div>
      </div>

      {cargando && <p className="vacio">Cargando…</p>}
      {error && <p className="error">No se pudieron cargar los viajes: {error.message}</p>}

      <ul className="viajes">
        {visibles.map((v) => (
          <li key={v.id}>
            <button onClick={() => onSeleccionar(v.id)}>
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
    </aside>
  )
}
