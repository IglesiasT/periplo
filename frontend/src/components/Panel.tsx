import { useState } from 'react'
import { ETIQUETAS_ESTADO_VIAJE, rangoFechas } from '../etiquetas'
import { useFichas } from '../hooks/consultas'
import { viajeElegido, type Seleccion } from '../seleccion'
import type { Foto, Logro, Viaje } from '../types'
import Estadisticas from './Estadisticas'
import FotosLista from './FotosLista'
import { LogrosLista, LogrosResumen } from './Logros'
import RegionFicha from './RegionFicha'
import ViajeForm from './ViajeForm'
import VisitasLista from './VisitasLista'

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
  /** Qué hacen los clicks en el mapa: abrir la ficha de la región o marcarla en el viaje elegido. */
  modo: Modo
  onCambiarModo: (modo: Modo) => void
  /** Resultado o error de la última acción sobre el mapa. */
  aviso: string | null
  onAviso: (aviso: string | null) => void
}

export type Modo = 'ninguno' | 'marcar'

export default function Panel({
  viajes, fotos, logros, cargando, error, seleccion, onSeleccionar,
  modo, onCambiarModo, aviso, onAviso,
}: Props) {
  const alternar = (m: Modo) => onCambiarModo(modo === m ? 'ninguno' : m)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const viaje = viajeElegido(seleccion, viajes)

  if (seleccion?.tipo === 'nuevo') {
    return (
      <aside className="panel">
        <button className="volver" onClick={() => onSeleccionar(null)}>← Viajes</button>
        <h2>Nuevo viaje</h2>
        <ViajeForm onGuardado={(nuevo) => onSeleccionar({ tipo: 'viaje', id: nuevo.id })} />
      </aside>
    )
  }

  if (seleccion?.tipo === 'region') {
    return (
      <aside className="panel">
        <button className="volver" onClick={() => onSeleccionar(null)}>← Viajes</button>
        <RegionFicha codigo={seleccion.codigo} onElegirViaje={(id) => onSeleccionar({ tipo: 'viaje', id })} />
      </aside>
    )
  }

  if (seleccion?.tipo === 'logros') {
    const completos = logros?.filter((l) => l.completo).length ?? 0
    return (
      <aside className="panel">
        <button className="volver" onClick={() => onSeleccionar(null)}>← Viajes</button>
        <h2>Logros</h2>
        <p className="cursiva">
          {completos} de {logros?.length ?? 0} sellados. Elegí uno para ver sus regiones en el mapa.
        </p>
        {logros ? (
          <LogrosLista
            logros={logros} elegido={seleccion.logro}
            onElegir={(logro) => onSeleccionar({ tipo: 'logros', logro })}
          />
        )
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
        <button onClick={() => onSeleccionar({ tipo: 'nuevo' })}>+ Viaje</button>
      </header>

      <Estadisticas />

      {logros && <LogrosResumen logros={logros} onVerTodos={() => onSeleccionar({ tipo: 'logros', logro: null })} />}

      <FichasResumen onElegir={(codigo) => onSeleccionar({ tipo: 'region', codigo })} />

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
            <button onClick={() => onSeleccionar({ tipo: 'viaje', id: v.id })}>
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

/** Las fichas escritas, para volver a ellas sin buscar la región en el mapa. */
function FichasResumen({ onElegir }: { onElegir: (codigo: string) => void }) {
  const fichas = useFichas()
  return (
    <section>
      <div className="encabezado-seccion">
        <h3>Fichas</h3>
        {fichas.data && fichas.data.length > 0 && <span className="tenue">{fichas.data.length} escritas</span>}
      </div>
      {fichas.data && fichas.data.length > 0 ? (
        <p className="fichas-lista">
          {fichas.data.map((f, i) => (
            <span key={f.codigo}>
              {i > 0 && ' · '}
              <button className="enlace" onClick={() => onElegir(f.codigo)}>{f.nombre}</button>
            </span>
          ))}
        </p>
      ) : (
        <p className="cursiva">Hacé click en una región del mapa para abrir su ficha y escribir sobre ella.</p>
      )}
    </section>
  )
}
