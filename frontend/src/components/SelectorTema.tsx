import { useTema } from '../tema/contexto'

/** Al pie del panel: un punto por tema, con el mar y el acento de cada uno. La elección se recuerda en el navegador. */
export default function SelectorTema() {
  const { tema, temas, elegirTema } = useTema()
  return (
    <fieldset className="pie-panel">
      <legend>Tema · {tema.nombre}</legend>
      <div className="selector-tema">
        {temas.map((opcion) => (
          <label
            key={opcion.id} title={opcion.nombre} className={opcion.id === tema.id ? 'activa' : ''}
            style={{ background: `linear-gradient(135deg, ${opcion.mapa.mar} 50%, ${opcion.estados.estadia} 50%)` }}
          >
            <input
              type="radio" name="tema" value={opcion.id} aria-label={opcion.nombre} checked={opcion.id === tema.id}
              onChange={() => elegirTema(opcion.id)}
            />
          </label>
        ))}
      </div>
    </fieldset>
  )
}
