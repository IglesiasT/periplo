import { useState } from 'react'
import { ETIQUETAS_ESTADO_VIAJE, ETIQUETAS_MARCA, ETIQUETAS_NIVEL, etiquetaVisita } from '../etiquetas'
import { rangoMeses } from '../fechas'
import { useMarcas, useVisitasSueltas } from '../hooks/consultas'
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
  /** Abre la ficha de una región. */
  onElegirRegion: (codigo: string) => void
  /** El modo de marcar sin viaje: cada click en el mapa avanza la marca de esa región. */
  marcando: boolean
  onCambiarMarcando: (marcando: boolean) => void
  aviso: string | null
}

export default function ViajesLista({
  viajes, cargando, error, onElegir, onNuevo, onElegirRegion, marcando, onCambiarMarcando, aviso,
}: Props) {
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
      <div className="encabezado-seccion">
        <span className="tenue cursiva">Sin viaje: corregir o marcar donde viviste.</span>
        <button className={marcando ? 'activa' : ''} onClick={() => onCambiarMarcando(!marcando)}>
          {marcando ? 'Listo' : 'Marcar en el mapa'}
        </button>
      </div>
      {marcando && (
        <p className="aviso">
          Hacé click en una región. Cada click avanza: visitada → hogar → deseo → sin marca.
          Le gana a lo que digan los viajes y Notion, sin borrarlos; si pisa algo, te pregunta antes.
        </p>
      )}
      {aviso && <p className="aviso-accion">{aviso}</p>}

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
                  {[ETIQUETAS_ESTADO_VIAJE[v.estado], rangoMeses(v.fecha_inicio, v.fecha_fin),
                    v.visitas.length ? `${v.visitas.length} ${v.visitas.length === 1 ? 'región' : 'regiones'}`
                      : 'sin regiones aún']
                    .filter(Boolean).join(' · ')}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <MarcadoAMano onElegir={onElegirRegion} />
      <LugaresSueltos onElegir={onElegirRegion} />
    </>
  )
}

/** Lo que marqué a mano en el mapa, sin viaje: correcciones y donde viví. */
function MarcadoAMano({ onElegir }: { onElegir: (codigo: string) => void }) {
  const { data } = useMarcas()
  if (!data?.length) return null
  return (
    <section>
      <h3>Marcado a mano</h3>
      <ul className="viajes">
        {data.map((marca) => (
          <li key={marca.codigo}>
            <button onClick={() => onElegir(marca.codigo)}>
              <span className={marca.estado === 'deseo' || marca.estado === 'ninguno' ? 'marca marca-plan' : 'marca marca-hecho'}
                    aria-hidden="true" />
              <span className="viaje-texto">
                <strong>{marca.nombre}</strong>
                <span className="tenue">{ETIQUETAS_NIVEL[marca.nivel]} · {ETIQUETAS_MARCA[marca.estado]}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Lo visitado que no cuelga de ningún viaje (los Lugares de Notion sin destino): pinta el mapa igual. */
function LugaresSueltos({ onElegir }: { onElegir: (codigo: string) => void }) {
  const { data } = useVisitasSueltas()
  if (!data?.length) return null
  const ordenadas = [...data].sort((a, b) => a.region_nombre.localeCompare(b.region_nombre, 'es'))
  return (
    <section>
      <h3>Lugares sueltos</h3>
      <ul className="viajes">
        {ordenadas.map((visita) => (
          <li key={visita.id}>
            <button onClick={() => onElegir(visita.region)}>
              <span className={visita.realizada ? 'marca marca-hecho' : 'marca marca-plan'} aria-hidden="true" />
              <span className="viaje-texto">
                <strong>{visita.region_nombre}</strong>
                <span className="tenue">
                  {ETIQUETAS_NIVEL[visita.region_nivel]} · {etiquetaVisita(visita)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
