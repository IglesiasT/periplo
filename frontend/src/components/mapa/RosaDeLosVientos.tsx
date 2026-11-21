import { useEffect, useState } from 'react'
import type * as maplibregl from 'maplibre-gl'
import type { Tema } from '../../tema'

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
      <svg width="86" height="86" viewBox="-43 -43 86 86" aria-hidden="true">
        {/* El rumbo de MapLibre es hacia dónde mira la pantalla: el norte queda girado al revés. */}
        <g transform={`rotate(${-rumbo})`}>
          <circle r="28" fill="none" stroke={tinta} strokeWidth="0.8" />
          <circle r="24" fill="none" stroke={tinta} strokeWidth="0.5" />
          <path d="M0 -32L4.5 0L0 32L-4.5 0Z" fill={tinta} />
          <path d="M-32 0L0 -4.5L32 0L0 4.5Z" fill={papel} stroke={tinta} strokeWidth="0.8" />
          <path d="M0 -32L4.5 0L0 0Z" fill={tema.estados.estadia} />
          <text y="-35" textAnchor="middle" fontFamily={tema.fuentes.titulo} fontSize="11" fill={tinta}>N</text>
        </g>
      </svg>
    </button>
  )
}
