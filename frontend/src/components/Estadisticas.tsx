import { useEstadisticas } from '../hooks/consultas'

const proporcion = (visitados: number, total: number) => (total ? (100 * visitados) / total : 0)

export default function Estadisticas() {
  const { data, error } = useEstadisticas()

  if (error) return <p className="error">No se pudieron cargar las estadísticas.</p>
  if (!data) return null

  return (
    <section className="estadisticas">
      {/* Los países son la cifra del proyecto: va grande, el resto acompaña. */}
      <div className="cifra-principal">
        <span className="cifra-grande">{data.paises_visitados}</span>
        <span className="cursiva">de {data.paises_total} países<br />visitados</span>
      </div>
      <div className="cifras">
        <Cifra valor={`${data.provincias_argentinas_visitadas} de ${data.provincias_argentinas_total}`}
               etiqueta="provincias argentinas" />
        <Cifra valor={`${data.continentes_visitados} de ${data.continentes_total}`} etiqueta="continentes" />
        <Cifra valor={String(data.entidades_historicas_pisadas)} etiqueta="entidades históricas" />
      </div>

      <h3>Países</h3>
      <ul className="barras">
        {data.paises.map((p) => (
          <li key={p.codigo}>
            <div className="barra-titulo">
              <span>{p.nombre}</span>
              <span className="tenue">{p.provincias_visitadas}/{p.provincias_total} provincias</span>
            </div>
            <Barra porcentaje={proporcion(p.provincias_visitadas, p.provincias_total)} />
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
            <Barra porcentaje={proporcion(c.visitados, c.total)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function Cifra({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="cifra">
      <span className="cifra-valor">{valor}</span>
      <span className="cifra-etiqueta">{etiqueta}</span>
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
