import { formatearFecha } from '../etiquetas'
import { useFichas } from '../hooks/consultas'

/** Las fichas escritas, de la última editada a la primera, para volver a ellas sin buscar la región en el mapa. */
export default function FichasLista({ onElegir }: { onElegir: (codigo: string) => void }) {
  const fichas = useFichas()

  if (fichas.isPending) return <p className="vacio">Cargando…</p>
  if (fichas.error) return <p className="error">No se pudieron cargar las fichas: {fichas.error.message}</p>
  if (fichas.data.length === 0) {
    return <p className="cursiva">Hacé click en una región del mapa para abrir su ficha y escribir sobre ella.</p>
  }

  return (
    <ul className="viajes">
      {fichas.data.map((ficha) => (
        <li key={ficha.codigo}>
          <button onClick={() => onElegir(ficha.codigo)}>
            <span className="viaje-texto">
              <strong>{ficha.nombre}</strong>
              <span className="tenue">{formatearFecha(ficha.actualizada.slice(0, 10))}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
