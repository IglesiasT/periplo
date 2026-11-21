import { useRef, useState } from 'react'
import { enmascarar, isoATexto, textoAIso } from '../fechas'

interface Props {
  /** ISO ('2026-01-15') o null. */
  valor: string | null
  onCambio: (iso: string | null) => void
}

/**
 * Fecha en día/mes/año. El <input type="date"> nativo sigue el idioma del navegador y no el de la página:
 * en un Chrome en inglés pide mes/día. Este campo se escribe siempre dd/mm/aaaa; el botón abre el
 * calendario del navegador, que solo elige la fecha.
 */
export default function CampoFecha({ valor, onCambio }: Props) {
  const [texto, setTexto] = useState(isoATexto(valor))
  const [previo, setPrevio] = useState(valor)
  const calendario = useRef<HTMLInputElement>(null)

  // Si la fecha cambia desde afuera (el calendario, descartar cambios), el texto la sigue.
  if (valor !== previo) {
    setPrevio(valor)
    if (textoAIso(texto) !== valor) setTexto(isoATexto(valor))
  }

  const escribir = (nuevo: string) => {
    const enmascarado = enmascarar(nuevo)
    setTexto(enmascarado)
    // Solo avisa cuando hay una fecha entera o el campo quedó vacío; a medio escribir, espera.
    if (enmascarado === '') onCambio(null)
    else if (textoAIso(enmascarado)) onCambio(textoAIso(enmascarado))
  }

  return (
    <span className="campo-fecha">
      <input
        value={texto}
        placeholder="dd/mm/aaaa"
        inputMode="numeric"
        aria-invalid={texto !== '' && textoAIso(texto) === null}
        onChange={(e) => escribir(e.target.value)}
        // Al salir con una fecha a medio escribir o imposible, vuelve a la última válida.
        onBlur={() => { if (texto !== '' && !textoAIso(texto)) setTexto(isoATexto(valor)) }}
      />
      <button type="button" className="campo-fecha-calendario" aria-label="Elegir en el calendario"
              onClick={() => calendario.current?.showPicker()}>
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <rect x="2" y="3" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" />
          <path d="M2 6.5h12M5 1.5v3M11 1.5v3" fill="none" stroke="currentColor" />
        </svg>
      </button>
      <input ref={calendario} type="date" className="campo-fecha-nativo" tabIndex={-1} aria-hidden="true"
             value={valor ?? ''} onChange={(e) => onCambio(e.target.value || null)} />
    </span>
  )
}
