import Markdown from 'react-markdown'
import { avisoMarca, estadoDeVisitas, pisa } from '../conflictos'
import { ETIQUETAS_ESTADO, ETIQUETAS_MARCA, ETIQUETAS_NIVEL, etiquetaVisita, formatearFecha } from '../etiquetas'
import { rangoMeses } from '../fechas'
import { paisConBandera } from '../banderas'
import { colorDeTono, formatearAnio } from '../historia'
import { useGuardarFicha, useMarcar, useRegion } from '../hooks/consultas'
import { useBorrador } from '../hooks/useBorrador'
import type { EstadoMarca, RegionDetalle } from '../types'
import { useConfirmar } from '../hooks/useConfirmar'
import { useTema } from '../tema/contexto'
import Bandera from './Bandera'

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
  // Un país lleva su bandera junto al nombre; una provincia o un departamento, la de su país junto a "de Argentina".
  const pais = paisConBandera([codigo, ...ancestros.map((a) => a.codigo)])
  const nombrePais = pais === codigo ? nombre : ancestros.find((a) => a.codigo === pais)?.nombre ?? ''
  return (
    <>
      <h2 className="con-bandera">{pais === codigo && <Bandera codigo={pais} nombre={nombrePais} />}{nombre}</h2>
      <p className="cursiva con-bandera">
        {pais !== codigo && <Bandera codigo={pais} nombre={nombrePais} />}
        {ancestros.length ? `${capitalizar(ETIQUETAS_NIVEL[nivel])} de ${ancestros.map((a) => a.nombre).join(', ')}`
          : capitalizar(ETIQUETAS_NIVEL[nivel])}
      </p>
      <EnElMapa region={region.data} />
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
  const [borrador, setBorrador] = useBorrador<string>(`ficha.${region.codigo}`)
  const guardar = useGuardarFicha()
  const confirmar = useConfirmar()
  const { ficha } = region
  const sinGuardar = borrador !== null && borrador !== (ficha?.texto ?? '')

  const enviar = async () => {
    const texto = borrador ?? ''
    // Vaciar una ficha escrita la borra para siempre: que no pase por un descuido.
    if (ficha && !texto.trim() && !(await confirmar({
      titulo: `¿Borrar la ficha de ${region.nombre}?`, mensaje: 'Lo escrito no se puede recuperar.', aceptar: 'Borrar',
    }))) return
    guardar.mutate({ codigo: region.codigo, texto }, { onSuccess: () => setBorrador(null) })
  }

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
          {sinGuardar && <span className="tenue cursiva">Sin guardar: si te vas, sigue acá cuando vuelvas.</span>}
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

const ORDEN_MARCAS: EstadoMarca[] = ['visitada', 'hogar', 'deseo', 'ninguno']

/** Lo que digo yo de la región: le gana a lo que digan las visitas, sin borrarlas. */
function EnElMapa({ region }: { region: RegionDetalle }) {
  const marcar = useMarcar()
  const confirmar = useConfirmar()
  const visitas = estadoDeVisitas(region)
  const actual = region.marca?.estado ?? null
  // "No fui" solo tiene sentido si hay visitas que anular (o si ya está puesto).
  const opciones = ORDEN_MARCAS.filter((m) => m !== 'ninguno' || visitas !== null || actual === 'ninguno')

  const cambiar = async (nueva: EstadoMarca | null) => {
    const aviso = avisoMarca(region, nueva)
    if (aviso && !(await confirmar(aviso))) return
    marcar.mutate({ codigo: region.codigo, estado: nueva })
  }

  // Las dos fuentes, cuando la marca esconde lo que dicen las visitas (no cuando solo agrega, como hogar).
  const esconde = actual !== null && visitas !== null && pisa(actual, visitas)

  return (
    <section>
      <div className="encabezado-seccion">
        <h3>En el mapa</h3>
        {actual && (
          <button className="enlace" onClick={() => cambiar(null)} disabled={marcar.isPending}>Quitar marca</button>
        )}
      </div>
      <div className="filtros marcas">
        {opciones.map((m) => (
          <button key={m} className={m === actual ? 'activa' : ''} aria-pressed={m === actual}
                  disabled={marcar.isPending} onClick={() => cambiar(m === actual ? null : m)}>
            {ETIQUETAS_MARCA[m]}
          </button>
        ))}
      </div>
      {esconde && (
        <p className="tenue cursiva">
          Las visitas dicen {ETIQUETAS_ESTADO[visitas].toLowerCase()}; manda lo que marcaste. Los viajes no cambian.
        </p>
      )}
      {marcar.error && <p className="error">{marcar.error.message}</p>}
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
              etiquetaVisita(v),
            ].filter(Boolean).join(' · ')
            return (
              <li key={v.id}>
                <div>
                  {v.viaje !== null ? (
                    <button className="enlace" onClick={() => onElegirViaje(v.viaje!)}>{v.viaje_nombre}</button>
                  ) : <strong>Sin viaje</strong>}
                  {v.viaje_inicio && <span className="tenue"> · {rangoMeses(v.viaje_inicio, v.viaje_fin)}</span>}
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
  const { tema } = useTema()
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
            <span className="tramo-entidad">
              {/* El color con que el mapa pinta a la entidad, para reconocerla al mirar ese año. */}
              {tramo.tono !== null && (
                <span className="leyenda-color" style={{ background: colorDeTono(tramo.tono, true, tema.aguadas) }} />
              )}
              {tramo.nombre}
            </span>
          </li>
        ))}
      </ol>
      <p className="tenue cursiva">
        Según los mapas de historical-basemaps: solo los años que tienen mapa, con fronteras aproximadas.
      </p>
    </section>
  )
}
