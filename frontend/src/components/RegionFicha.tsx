import { useState } from 'react'
import Markdown from 'react-markdown'
import { ETIQUETAS_NIVEL, ETIQUETAS_PRESENCIA, formatearFecha } from '../etiquetas'
import { formatearAnio } from '../historia'
import { useGuardarFicha, useRegion } from '../hooks/consultas'
import type { RegionDetalle } from '../types'

interface Props {
  codigo: string
  /** Abre un viaje de la lista de visitas. */
  onElegirViaje: (id: number) => void
}

/** Ficha de una región: lo que escribí sobre ella, cuándo la visité y a quién perteneció. */
export default function RegionFicha({ codigo, onElegirViaje }: Props) {
  const region = useRegion(codigo)

  if (region.isPending) return <p className="vacio">Cargando…</p>
  if (region.error) return <p className="error">No se pudo cargar la región: {region.error.message}</p>

  const { nombre, nivel, ancestros } = region.data
  return (
    <>
      <h2>{nombre}</h2>
      <p className="cursiva">
        {ancestros.length ? `${capitalizar(ETIQUETAS_NIVEL[nivel])} de ${ancestros.map((a) => a.nombre).join(', ')}`
          : capitalizar(ETIQUETAS_NIVEL[nivel])}
      </p>
      {/* key: al cambiar de región, el editor arranca cerrado y con el texto de la nueva. */}
      <Texto key={codigo} region={region.data} />
      <Visitas region={region.data} onElegirViaje={onElegirViaje} />
      <Historia region={region.data} />
    </>
  )
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function Texto({ region }: { region: RegionDetalle }) {
  const [borrador, setBorrador] = useState<string | null>(null)
  const guardar = useGuardarFicha()
  const { ficha } = region

  const enviar = () =>
    guardar.mutate({ codigo: region.codigo, texto: borrador ?? '' }, { onSuccess: () => setBorrador(null) })

  return (
    <section>
      <div className="encabezado-seccion">
        <h3>Ficha</h3>
        {borrador === null && (
          <button onClick={() => setBorrador(ficha?.texto ?? '')}>{ficha ? 'Editar' : 'Escribir'}</button>
        )}
      </div>

      {borrador !== null ? (
        <div className="formulario">
          <textarea rows={12} value={borrador} autoFocus onChange={(e) => setBorrador(e.target.value)}
                    placeholder={`Qué viste en ${region.nombre}, qué comiste, qué te contaron… Admite markdown.`} />
          {guardar.error && <span className="error">{guardar.error.message}</span>}
          <div className="acciones">
            <button type="submit" onClick={enviar} disabled={guardar.isPending}>
              {guardar.isPending ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => { setBorrador(null); guardar.reset() }}>Cancelar</button>
            {ficha && <span className="tenue">Vaciala y guardá para borrarla.</span>}
          </div>
        </div>
      ) : ficha ? (
        <>
          <div className="ficha-texto"><Markdown>{ficha.texto}</Markdown></div>
          <p className="tenue cursiva">Última edición: {formatearFecha(ficha.actualizada.slice(0, 10))}</p>
        </>
      ) : (
        <p className="vacio">Todavía no escribiste nada sobre {region.nombre}.</p>
      )}
    </section>
  )
}

function Visitas({ region, onElegirViaje }: { region: RegionDetalle; onElegirViaje: (id: number) => void }) {
  return (
    <section>
      <h3>Visitas</h3>
      {region.visitas.length === 0 ? <p className="vacio">Ninguna todavía.</p> : (
        <ul className="visitas">
          {region.visitas.map((v) => {
            const detalle = [
              v.region !== region.codigo ? v.region_nombre : null,
              v.realizada ? ETIQUETAS_PRESENCIA[v.tipo_presencia] : 'Deseo',
            ].filter(Boolean).join(' · ')
            return (
              <li key={v.id}>
                <div>
                  {v.viaje !== null ? (
                    <button className="enlace" onClick={() => onElegirViaje(v.viaje!)}>{v.viaje_nombre}</button>
                  ) : <strong>Sin viaje</strong>}
                  {v.viaje_inicio && <span className="tenue"> · {formatearFecha(v.viaje_inicio)}</span>}
                </div>
                <span className="tenue">{detalle}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Historia({ region }: { region: RegionDetalle }) {
  if (region.historia.length === 0) return null
  return (
    <section>
      <h3>A quién perteneció</h3>
      <ol className="linea-historica">
        {region.historia.map((tramo) => (
          <li key={tramo.desde}>
            <span className="tramo-anios">
              {tramo.desde === tramo.hasta ? formatearAnio(tramo.desde)
                : `${formatearAnio(tramo.desde)} – ${formatearAnio(tramo.hasta)}`}
            </span>
            <span>{tramo.nombre}</span>
          </li>
        ))}
      </ol>
      <p className="tenue cursiva">
        Según los mapas de historical-basemaps: solo los años que tienen mapa, con fronteras aproximadas.
      </p>
    </section>
  )
}
