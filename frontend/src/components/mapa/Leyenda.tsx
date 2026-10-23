import { ETIQUETAS_ESTADO } from '../../etiquetas'
import type { Tema } from '../../tema'
import type { EstadoRegion } from '../../types'

export default function Leyenda({ tema }: { tema: Tema }) {
  const items = [
    ...(Object.keys(tema.estados) as EstadoRegion[]).map((estado) => ({
      etiqueta: ETIQUETAS_ESTADO[estado], color: tema.estados[estado], clase: estado === 'deseo' ? 'deseo' : '',
    })),
    { etiqueta: 'Sin visitar', color: tema.mapa.noVisitado, clase: '' },
  ]
  return (
    <div className="leyenda">
      <p className="leyenda-titulo">Leyenda</p>
      {items.map(({ etiqueta, color, clase }) => (
        <div key={etiqueta}>
          <span className={`leyenda-color ${clase}`} style={{ background: color }} />
          {etiqueta}
        </div>
      ))}
    </div>
  )
}
