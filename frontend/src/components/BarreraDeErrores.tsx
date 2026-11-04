import { Component, type ReactNode } from 'react'

interface Estado {
  error: Error | null
}

/** Una excepción al dibujar no deja la página en blanco: avisa y ofrece recargar. Los borradores están a salvo. */
export default class BarreraDeErrores extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { error: null }

  static getDerivedStateFromError(error: Error): Estado {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="fallo" role="alert">
        <h1>Se rompió la plancha</h1>
        <p className="cursiva">Algo falló al dibujar la página. Lo que estabas escribiendo sigue guardado.</p>
        <p className="error">{this.state.error.message}</p>
        <button onClick={() => window.location.reload()}>Recargar</button>
      </div>
    )
  }
}
