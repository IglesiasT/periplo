import type { Tema } from '../../tema'

/** Adorno de atlas: siempre apunta al norte porque el mapa no rota. */
export default function RosaDeLosVientos({ tema }: { tema: Tema }) {
  const { tinta, papel } = tema.ui
  return (
    <svg className="rosa" width="70" height="78" viewBox="-35 -43 70 78" aria-hidden="true">
      <circle r="28" fill="none" stroke={tinta} strokeWidth="0.8" />
      <circle r="24" fill="none" stroke={tinta} strokeWidth="0.5" />
      <path d="M0 -32L4.5 0L0 32L-4.5 0Z" fill={tinta} />
      <path d="M-32 0L0 -4.5L32 0L0 4.5Z" fill={papel} stroke={tinta} strokeWidth="0.8" />
      <path d="M0 -32L4.5 0L0 0Z" fill={tema.estados.estadia} />
      <text y="-35" textAnchor="middle" fontFamily={tema.fuentes.titulo} fontSize="11" fill={tinta}>N</text>
    </svg>
  )
}
