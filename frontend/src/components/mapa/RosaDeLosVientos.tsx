import { useEffect, useState } from 'react'
import type * as maplibregl from 'maplibre-gl'
import type { Tema } from '../../tema'
import { ROSA } from './rosa'

/**
 * Rosa de los vientos del atlas: apunta al norte del mapa y, si se lo rota (click derecho y arrastrar), gira con él.
 * Escucha el giro por su cuenta para que cada cuadro de la rotación no vuelva a dibujar todo el mapa en React.
 */
export default function RosaDeLosVientos({ tema, mapa }: { tema: Tema; mapa: maplibregl.Map | null }) {
  const { tinta, papel } = tema.ui
  const [rumbo, setRumbo] = useState(0)

  useEffect(() => {
    if (!mapa) return
    const alRotar = () => setRumbo(mapa.getBearing())
    alRotar()
    mapa.on('rotate', alRotar)
    return () => {
      mapa.off('rotate', alRotar)
    }
  }, [mapa])

  // Hace las veces de la brújula de MapLibre (apagada en Mapa.tsx): un click vuelve al norte y endereza la inclinación.
  return (
    <button
      type="button"
      className="rosa"
      aria-label="Orientar al norte"
      title="Orientar al norte"
      disabled={!mapa}
      onClick={() => mapa?.resetNorthPitch()}
    >
      <svg width={ROSA.lado} height={ROSA.lado} viewBox={`${-ROSA.lado / 2} ${-ROSA.lado / 2} ${ROSA.lado} ${ROSA.lado}`} aria-hidden="true">
        {/* El rumbo de MapLibre es hacia dónde mira la pantalla: el norte queda girado al revés. */}
        <g transform={`rotate(${-rumbo})`}>
          {ROSA.circulos.map(({ r, trazo }) => (
            <circle key={r} r={r} fill="none" stroke={tinta} strokeWidth={trazo} />
          ))}
          <path d={ROSA.meridiano} fill={tinta} />
          <path d={ROSA.paralelo} fill={papel} stroke={tinta} strokeWidth="0.8" />
          <path d={ROSA.norte} fill={tema.estados.visitada} />
          <text y={ROSA.letra.y} textAnchor="middle" fontFamily={tema.fuentes.titulo} fontSize={ROSA.letra.tam}
                fill={tinta}>N</text>
        </g>
      </svg>
    </button>
  )
}
