import type { Logro } from '../types'

/** Primero los completos, después los más avanzados. */
function ordenarLogros(logros: Logro[]): Logro[] {
  const avance = (l: Logro) => (l.total ? l.cumplidos / l.total : 0)
  return [...logros].sort((a, b) => Number(b.completo) - Number(a.completo) || avance(b) - avance(a)
    || a.nombre.localeCompare(b.nombre, 'es'))
}

interface ListaProps {
  logros: Logro[]
  /** El logro desplegado: sus regiones se resaltan en el mapa. */
  elegido: string | null
  onElegir: (id: string | null) => void
}

export function LogrosLista({ logros, elegido, onElegir }: ListaProps) {
  return (
    <ul className="logros">
      {ordenarLogros(logros).map((logro) => {
        const abierto = logro.id === elegido
        // Cumplidos primero, para que se vea qué falta de un vistazo.
        const objetivos = [...logro.objetivos].sort((a, b) => Number(b.cumplido) - Number(a.cumplido)
          || a.nombre.localeCompare(b.nombre, 'es'))
        return (
          <li key={logro.id} className={abierto ? 'logro abierto' : 'logro'}>
            <button className="logro-cabecera" aria-expanded={abierto} onClick={() => onElegir(abierto ? null : logro.id)}>
              <Sello cumplidos={logro.cumplidos} total={logro.total} />
              <span className="logro-texto">
                <strong>{logro.nombre}</strong>
                <span className="tenue">{logro.completo ? 'Sellado' : `${logro.cumplidos} de ${logro.total}`}</span>
              </span>
            </button>
            {abierto && (
              <div className="logro-detalle">
                <p className="cursiva">{logro.descripcion}</p>
                <ul className="objetivos">
                  {objetivos.map((objetivo) => (
                    <li key={objetivo.nombre} className={objetivo.cumplido ? 'cumplido' : ''}>{objetivo.nombre}</li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// Borde ondulado de un sello de lacre y una rosa de los vientos de ocho puntas, centrados en (17, 17).
const BORDE_LACRE = poligono(72, (i) => 15 + 1.1 * Math.cos((i / 72) * Math.PI * 2 * 12))
const ESTRELLA = poligono(16, (i) => (i % 2 === 0 ? 7.5 : 2.6))

function poligono(puntos: number, radio: (i: number) => number): string {
  return Array.from({ length: puntos }, (_, i) => {
    const angulo = (i / puntos) * Math.PI * 2 - Math.PI / 2
    return `${(17 + radio(i) * Math.cos(angulo)).toFixed(2)} ${(17 + radio(i) * Math.sin(angulo)).toFixed(2)}`
  }).reduce((d, punto, i) => `${d}${i ? 'L' : 'M'}${punto}`, '') + 'Z'
}

/** Sello del logro: un anillo que se va cerrando con el avance; al completarse, lacre carmín. */
function Sello({ cumplidos, total }: { cumplidos: number; total: number }) {
  const circunferencia = 2 * Math.PI * 13
  if (total > 0 && cumplidos === total) {
    return (
      <svg className="sello" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <path className="sello-lacre" d={BORDE_LACRE} />
        <circle className="sello-anillo" cx="17" cy="17" r="11" />
        <path className="sello-estrella" d={ESTRELLA} />
      </svg>
    )
  }
  return (
    <svg className="sello" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <circle className="sello-pista" cx="17" cy="17" r="13" />
      {cumplidos > 0 && (
        <circle className="sello-avance" cx="17" cy="17" r="13" transform="rotate(-90 17 17)"
                strokeDasharray={`${(cumplidos / total) * circunferencia} ${circunferencia}`} />
      )}
      <path className="sello-estrella-vacia" d={ESTRELLA} />
    </svg>
  )
}
