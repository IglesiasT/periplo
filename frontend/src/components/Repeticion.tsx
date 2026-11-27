import { useReproduccion } from '../hooks/useReproduccion'
import { paradaAnterior, paradaSiguiente } from '../paradas'
import { cuenta, momentoDe, type ParadaRepeticion, paradasRepeticion, rotuloDe } from '../repeticion'
import type { Repeticion } from '../types'

interface Props {
  repeticion: Repeticion
  /** null = no se está mirando la repetición: el mapa de hoy. */
  parada: ParadaRepeticion
  onCambiar: (parada: ParadaRepeticion) => void
}

// ︎: que Windows no los dibuje como un emoji.
const REPRODUCIR = '▶︎'
const PAUSAR = '❚❚'

/** La repetición de mi mapa: cómo se fue pintando, viaje por viaje, como la repetición de una partida. Arranca con
 *  lo que no tiene fecha y termina en el mapa de hoy. Mientras no se la mira, es un solo renglón con el botón. */
export default function SelectorRepeticion({ repeticion, parada, onCambiar }: Props) {
  const paradas = paradasRepeticion(repeticion)
  const { reproduciendo, alternar, detener } = useReproduccion(paradas, parada, false, onCambiar)
  const anterior = paradaAnterior(paradas, parada)
  const siguiente = paradaSiguiente(paradas, parada)
  const { titulo, fecha } = rotuloDe(repeticion, parada)
  const etiquetaBoton = reproduciendo ? 'Pausar' : 'Ver cómo se pintó el mapa'

  const ir = (nueva: ParadaRepeticion) => {
    detener()
    onCambiar(nueva)
  }

  const boton = (
    <button aria-label={etiquetaBoton} title={etiquetaBoton} onClick={alternar}>
      {reproduciendo ? PAUSAR : REPRODUCIR}
    </button>
  )

  if (parada === null && !reproduciendo) {
    return (
      <div className="repeticion repeticion-cerrada">
        <span className="epoca-titulo">Mi periplo</span>
        <span className="epoca-mandos">
          <span className="tenue cursiva">
            {repeticion.pasos.length === 1 ? '1 viaje' : `${repeticion.pasos.length} viajes`}
          </span>
          {boton}
        </span>
      </div>
    )
  }

  return (
    <div className="repeticion">
      <div className="epoca-cabecera">
        <span className="epoca-titulo">Mi periplo</span>
        <span className="epoca-anio">{fecha}</span>
      </div>
      <p className="epoca-periodo">
        {titulo}
        {parada !== null && <span className="tenue"> · {cuenta(momentoDe(repeticion, parada))}</span>}
      </p>
      <div className="epoca-mandos">
        {boton}
        <button
          aria-label="Viaje anterior" title="Viaje anterior" disabled={anterior === undefined}
          onClick={() => ir(anterior!)}
        >
          ‹
        </button>
        <input
          type="range" min={0} max={paradas.length - 1} step={1} value={paradas.indexOf(parada)}
          aria-label="Momento de la repetición" aria-valuetext={`${titulo}, ${fecha}`}
          onChange={(e) => ir(paradas[Number(e.target.value)])}
        />
        <button
          aria-label="Viaje siguiente" title="Viaje siguiente" disabled={siguiente === undefined}
          onClick={() => ir(siguiente!)}
        >
          ›
        </button>
      </div>
      <div className="epoca-extremos tenue">
        <span>Sin fecha</span>
        <button className="epoca-plegar" onClick={() => ir(null)}>volver al mapa de hoy</button>
      </div>
    </div>
  )
}
