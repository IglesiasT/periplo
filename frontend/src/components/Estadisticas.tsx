import { useState } from 'react'
import { useEstadisticas } from '../hooks/consultas'

const numero = (n: number, decimales = 0) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })

export default function Estadisticas() {
  const { data, error } = useEstadisticas()
  const [abierto, setAbierto] = useState(false)

  if (error) return <p className="error">No se pudieron cargar las estadísticas.</p>
  if (!data) return null

  return (
    <section className="estadisticas">
      <div className="cifras">
        <Cifra valor={`${numero(data.porcentaje_mundo, 2)} %`} etiqueta="del mundo" />
        <Cifra valor={numero(data.km2_visitados)} etiqueta="km² recorridos" />
        <Cifra valor={`${data.paises_visitados}/${data.paises_total}`} etiqueta="países" />
        <Cifra valor={numero(data.km_rutas)} etiqueta="km de rutas" />
      </div>

      <button className="desplegar" onClick={() => setAbierto(!abierto)}>
        {abierto ? '▾' : '▸'} Detalle por país y continente
      </button>

      {abierto && (
        <>
          <h3>Países</h3>
          <ul className="barras">
            {data.paises.map((p) => (
              <li key={p.codigo}>
                <div className="barra-titulo">
                  <span>{p.nombre}</span>
                  <span className="tenue">
                    {numero(p.porcentaje, 1)} % · {p.provincias_visitadas}/{p.provincias_total} provincias
                  </span>
                </div>
                <Barra porcentaje={p.porcentaje} />
              </li>
            ))}
          </ul>

          <h3>Continentes</h3>
          <ul className="barras">
            {data.continentes.map((c) => (
              <li key={c.continente}>
                <div className="barra-titulo">
                  <span>{c.continente}</span>
                  <span className="tenue">{c.visitados}/{c.total} países</span>
                </div>
                <Barra porcentaje={(100 * c.visitados) / c.total} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function Cifra({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="cifra">
      <strong>{valor}</strong>
      <span className="tenue">{etiqueta}</span>
    </div>
  )
}

function Barra({ porcentaje }: { porcentaje: number }) {
  // Mínimo visible para que un 0,5 % no desaparezca.
  const ancho = porcentaje > 0 ? Math.max(porcentaje, 1.5) : 0
  return (
    <div className="barra">
      <div style={{ width: `${Math.min(ancho, 100)}%` }} />
    </div>
  )
}
