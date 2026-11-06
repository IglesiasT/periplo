import { useState } from 'react'
import { colorEntidad, formatearAnio, nombreEntidad } from '../historia'
import { useReproduccion } from '../hooks/useReproduccion'
import { esAntiguo, type Parada, paradaAnterior, paradasDe, paradaSiguiente } from '../paradas'
import { periodoDe } from '../periodos'
import { useTema } from '../tema/contexto'
import type { Epoca } from '../types'

interface SelectorProps {
  /** Años con snapshot, de menor a mayor. */
  anios: number[]
  /** null = el presente: el mapa de siempre, con los colores de las visitas. */
  anio: number | null
  /** Todavía no llegó el mapa de `anio`: se sigue viendo el anterior. */
  cargando: boolean
  onCambiar: (anio: number | null) => void
}

// \uFE0E: que Windows no los dibuje como un emoji.
const REPRODUCIR = '\u25B6\uFE0E'
const PAUSAR = '\u275A\u275A'

/** Slider de años sobre el mapa. Los snapshots no están equiespaciados (…, 1800, 1815, 1878, …), así que cada
 *  paso es un snapshot y no un año. La última parada es el presente. Debajo del año, el nombre de la época
 *  (ver periodos.ts). Los años más antiguos van plegados (ver paradas.ts). */
export function SelectorEpoca({ anios, anio, cargando, onCambiar }: SelectorProps) {
  const [verAntiguos, setVerAntiguos] = useState(false)
  const conAntiguos = verAntiguos || esAntiguo(anio)
  const paradas = paradasDe(anios, conAntiguos)
  const { reproduciendo, alternar, detener } = useReproduccion(paradas, anio, cargando, onCambiar)
  const anterior = paradaAnterior(paradas, anio)
  const siguiente = paradaSiguiente(paradas, anio)
  const periodo = anio === null ? 'El mapa de hoy' : periodoDe(anio)

  // Tocar el mapa a mano frena la reproducción: el que manda es el que está mirando.
  const ir = (parada: Parada) => {
    detener()
    onCambiar(parada)
  }
  const alternarAntiguos = () => {
    detener()
    setVerAntiguos(!conAntiguos)
    if (conAntiguos && esAntiguo(anio)) onCambiar(paradasDe(anios, false)[0])
  }

  return (
    <div className="epoca-selector">
      <div className="epoca-cabecera">
        <span className="epoca-titulo">Época</span>
        <span className="epoca-anio">{anio === null ? 'Hoy' : formatearAnio(anio)}</span>
      </div>
      <p className="epoca-periodo">{periodo}</p>
      <div className="epoca-mandos">
        <button
          aria-label={reproduciendo ? 'Pausar' : 'Recorrer los años'} title={reproduciendo ? 'Pausar' : 'Recorrer los años'}
          onClick={alternar}
        >
          {reproduciendo ? PAUSAR : REPRODUCIR}
        </button>
        <button
          aria-label="Año anterior" title="Año anterior" disabled={anterior === undefined}
          onClick={() => ir(anterior!)}
        >
          ‹
        </button>
        <input
          type="range" min={0} max={paradas.length - 1} step={1} value={paradas.indexOf(anio)}
          aria-label="Año del mapa" aria-valuetext={anio === null ? 'Hoy' : `${formatearAnio(anio)}, ${periodo}`}
          onChange={(e) => ir(paradas[Number(e.target.value)])}
        />
        <button
          aria-label="Año siguiente" title="Año siguiente" disabled={siguiente === undefined}
          onClick={() => ir(siguiente!)}
        >
          ›
        </button>
      </div>
      <div className="epoca-extremos tenue">
        <span>
          {formatearAnio(paradas[0] ?? 0)}
          {' · '}
          <button className="epoca-plegar" aria-expanded={conAntiguos} onClick={alternarAntiguos}>
            {conAntiguos ? 'ocultar los más antiguos' : 'ver los más antiguos'}
          </button>
        </span>
        <span>Hoy</span>
      </div>
    </div>
  )
}

const REGIONES_A_LA_VISTA = 3

/** "En 1800 pisaste territorio de X entidades": ocupa el lugar de la leyenda mientras se mira un año. */
export function EntidadesPisadas({ epoca }: { epoca: Epoca }) {
  const { pisadas } = epoca
  const { tema } = useTema()
  return (
    // Se pliega para ver el mapa de abajo, y sigue plegado al cambiar de año.
    <details className="epoca-panel" open>
      <summary className="leyenda-titulo">
        En {formatearAnio(epoca.anio)}<span className="epoca-panel-periodo"> · {periodoDe(epoca.anio)}</span>
      </summary>
      <p className="cursiva">
        {pisadas.length === 0 ? 'no pisaste territorio de ninguna entidad del mapa.'
          : `pisaste territorio de ${pisadas.length} ${pisadas.length === 1 ? 'entidad' : 'entidades'}:`}
      </p>
      <ul className="entidades">
        {pisadas.map(({ entidad, regiones }) => {
          // Varios departamentos se llaman igual ("Capital"): se nombran una vez.
          const nombres = [...new Set(regiones.map((r) => r.nombre))]
          const resto = nombres.length - REGIONES_A_LA_VISTA
          return (
            <li key={entidad}>
              <span className="leyenda-color" style={{ background: colorEntidad(entidad, epoca, true, tema.aguadas) }} />
              <span>
                {nombreEntidad(entidad, epoca)}
                <span className="tenue">
                  {' · '}{nombres.slice(0, REGIONES_A_LA_VISTA).join(', ')}
                  {resto > 0 && ` y ${resto} más`}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="epoca-fuente">
        Fronteras aproximadas de{' '}
        <a href="https://github.com/aourednik/historical-basemaps" target="_blank" rel="noreferrer">historical-basemaps</a>.
      </p>
    </details>
  )
}
