import { colorEntidad, formatearAnio, nombreEntidad } from '../historia'
import type { Epoca } from '../types'

interface SelectorProps {
  /** Años con snapshot, de menor a mayor. */
  anios: number[]
  /** null = el presente: el mapa de siempre, con los colores de las visitas. */
  anio: number | null
  onCambiar: (anio: number | null) => void
}

/** Slider de años sobre el mapa. Los snapshots no están equiespaciados (123000 a. C., 10000 a. C., …,
 *  1994, 2000), así que cada paso es un snapshot y no un año. La última parada es el presente. */
export function SelectorEpoca({ anios, anio, onCambiar }: SelectorProps) {
  const posicion = anio === null ? anios.length : anios.indexOf(anio)
  return (
    <div className="epoca-selector">
      <div className="epoca-cabecera">
        <span className="epoca-titulo">Época</span>
        <span className="epoca-anio">{anio === null ? 'Hoy' : formatearAnio(anio)}</span>
      </div>
      <input
        type="range" min={0} max={anios.length} step={1} value={posicion}
        aria-label="Año del mapa" aria-valuetext={anio === null ? 'Hoy' : formatearAnio(anio)}
        onChange={(e) => {
          const i = Number(e.target.value)
          onCambiar(i === anios.length ? null : anios[i])
        }}
      />
      <div className="epoca-extremos tenue">
        <span>{anios.length ? formatearAnio(anios[0]) : ''}</span>
        <span>Hoy</span>
      </div>
    </div>
  )
}

const REGIONES_A_LA_VISTA = 3

/** "En 1800 pisaste territorio de X entidades": ocupa el lugar de la leyenda mientras se mira un año. */
export function EntidadesPisadas({ epoca }: { epoca: Epoca }) {
  const { pisadas } = epoca
  return (
    <div className="epoca-panel">
      <p className="leyenda-titulo">En {formatearAnio(epoca.anio)}</p>
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
              <span className="leyenda-color" style={{ background: colorEntidad(entidad, epoca, true) }} />
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
    </div>
  )
}
