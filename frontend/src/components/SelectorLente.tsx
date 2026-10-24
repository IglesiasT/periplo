import type { Lente } from './mapa/Mapa'

const LENTES: { lente: Lente; nombre: string; ayuda: string }[] = [
  { lente: 'automatica', nombre: 'Automática', ayuda: 'Países de lejos, provincias al acercarse y, en Argentina, departamentos' },
  { lente: 'paises', nombre: 'Países', ayuda: 'Siempre países, con cualquier zoom' },
  { lente: 'provincias', nombre: 'Provincias', ayuda: 'Siempre provincias, con cualquier zoom' },
  { lente: 'departamentos', nombre: 'Departamentos', ayuda: 'Departamentos en Argentina; en el resto del mundo, provincias' },
]

interface Props {
  lente: Lente
  onCambiar: (lente: Lente) => void
}

/** Qué nivel muestra el mapa, como los modos de mapa de Victoria 3. Son radios de verdad, con aspecto de
 *  botones: se recorren con las flechas del teclado como cualquier grupo de opciones. */
export default function SelectorLente({ lente, onCambiar }: Props) {
  return (
    <fieldset className="lentes">
      <legend className="epoca-titulo">Vista</legend>
      <div className="lentes-opciones">
        {LENTES.map((opcion) => (
          <label key={opcion.lente} className={opcion.lente === lente ? 'activa' : ''} title={opcion.ayuda}>
            <input
              type="radio" name="lente" value={opcion.lente} checked={opcion.lente === lente}
              onChange={() => onCambiar(opcion.lente)}
            />
            {opcion.nombre}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
