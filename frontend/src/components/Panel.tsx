import { useEffect, useRef } from 'react'
import { useEstadisticas } from '../hooks/consultas'
import {
  abrirFicha, cerrarFicha, elegirLogro, elegirViaje, irAPestania, type Pestania, PESTANIAS, type Seleccion,
  viajeElegido,
} from '../seleccion'
import type { Foto, Logro, Viaje } from '../types'
import Estadisticas from './Estadisticas'
import FichasLista from './FichasLista'
import { LogrosLista } from './Logros'
import RegionFicha from './RegionFicha'
import ViajeDetalle from './ViajeDetalle'
import ViajeForm from './ViajeForm'
import ViajesLista from './ViajesLista'

const NOMBRES: Record<Pestania, string> = { viajes: 'Viajes', logros: 'Logros', fichas: 'Fichas', numeros: 'Números' }

interface Props {
  viajes: Viaje[] | undefined
  fotos: Foto[] | undefined
  logros: Logro[] | undefined
  cargando: boolean
  error: Error | null
  seleccion: Seleccion
  /** `acercar: false` si no hay que mover el mapa: cambiar de pestaña o volver no llevan a ningún lado. */
  onSeleccionar: (seleccion: Seleccion, opciones?: { acercar: boolean }) => void
  /** Qué hacen los clicks en el mapa: marcar la región en el viaje elegido, o abrir su ficha. */
  marcando: boolean
  onCambiarMarcando: (marcando: boolean) => void
  /** Resultado o error de la última acción sobre el mapa. */
  aviso: string | null
  onAviso: (aviso: string | null) => void
}

export default function Panel({
  viajes, fotos, logros, cargando, error, seleccion, onSeleccionar, marcando, onCambiarMarcando, aviso, onAviso,
}: Props) {
  const { pestania, viaje: idViaje, logro, region } = seleccion
  const viaje = viajeElegido(seleccion, viajes)
  const estadisticas = useEstadisticas().data

  // Otra pestaña, otro viaje u otra ficha arrancan de arriba. Desplegar un logro no: se lo está mirando.
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    panel.current?.scrollTo(0, 0)
  }, [pestania, idViaje, region])

  const cambiarPestania = (nueva: Pestania) => {
    if (nueva !== pestania || region) onSeleccionar(irAPestania(seleccion, nueva), { acercar: false })
  }
  const salirDelViaje = () => onSeleccionar(elegirViaje(seleccion, null), { acercar: false })
  // De vuelta a lo que había debajo de la ficha: el viaje elegido, si se la abrió desde ahí.
  const debajoDeLaFicha = pestania === 'viajes' && viaje ? viaje.nombre : NOMBRES[pestania]

  return (
    <aside className="panel" ref={panel}>
      <header className="encabezado">
        <div>
          <h1>Periplo</h1>
          <p className="lema">Atlas y diario de viajes</p>
        </div>
        {/* Los países son la cifra del proyecto: se ve siempre, el resto está en Números. */}
        {estadisticas && (
          <p className="cifra-encabezado">
            <span className="cifra-valor">{estadisticas.paises_visitados}</span>
            <span className="cifra-etiqueta">de {estadisticas.paises_total} países</span>
          </p>
        )}
      </header>

      <nav className="pestanias" role="tablist" aria-label="Secciones del panel">
        {PESTANIAS.map((p) => (
          <button
            key={p} role="tab" aria-selected={p === pestania} className={p === pestania ? 'activa' : ''}
            onClick={() => cambiarPestania(p)}
          >
            {NOMBRES[p]}
          </button>
        ))}
      </nav>

      {region ? (
        <>
          <button className="volver" onClick={() => onSeleccionar(cerrarFicha(seleccion), { acercar: false })}>
            ← Volver a {debajoDeLaFicha}
          </button>
          <RegionFicha codigo={region} onElegirViaje={(id) => onSeleccionar(elegirViaje(seleccion, id))} />
        </>
      ) : pestania === 'viajes' ? (
        idViaje === 'nuevo' ? (
          <>
            <button className="volver" onClick={salirDelViaje}>← Viajes</button>
            <h2>Nuevo viaje</h2>
            <ViajeForm onGuardado={(nuevo) => onSeleccionar(elegirViaje(seleccion, nuevo.id))} />
          </>
        ) : viaje ? (
          <ViajeDetalle
            viaje={viaje} fotos={fotos} onVolver={salirDelViaje}
            marcando={marcando} onCambiarMarcando={onCambiarMarcando} aviso={aviso} onAviso={onAviso}
          />
        ) : (
          <ViajesLista
            viajes={viajes} cargando={cargando} error={error}
            onElegir={(id) => onSeleccionar(elegirViaje(seleccion, id))}
            onNuevo={() => onSeleccionar(elegirViaje(seleccion, 'nuevo'))}
          />
        )
      ) : pestania === 'logros' ? (
        <>
          <p className="cursiva">
            {logros?.filter((l) => l.completo).length ?? 0} de {logros?.length ?? 0} sellados.
            {' '}Elegí uno para ver sus regiones en el mapa.
          </p>
          {logros ? (
            <LogrosLista
              logros={logros} elegido={logro}
              onElegir={(id) => onSeleccionar(elegirLogro(seleccion, id), { acercar: id !== null })}
            />
          ) : <p className="vacio">Cargando…</p>}
        </>
      ) : pestania === 'fichas' ? (
        <FichasLista onElegir={(codigo) => onSeleccionar(abrirFicha(seleccion, codigo))} />
      ) : (
        <Estadisticas />
      )}
    </aside>
  )
}
