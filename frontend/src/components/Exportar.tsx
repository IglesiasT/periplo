import { useEffect, useMemo, useRef, useState } from 'react'
import type * as maplibregl from 'maplibre-gl'
import { useEncuadre, useEstadisticas } from '../hooks/consultas'
import {
  codigosParaEncuadre, contenidoLamina, DENSIDAD, type Encuadre, encuadrePorDefecto, ESCALA_MAPA, FORMATOS, type Formato,
  nombreArchivo, ocultarHogar, zoomParaLamina,
} from '../lamina/contenido'
import { aPng, cargarFuentes, dibujarLamina } from '../lamina/dibujar'
import { layoutLamina } from '../lamina/layout'
import type { Resaltadas } from '../resaltado'
import type { Tema } from '../tema'
import type { Epoca, EstadosRegiones, Foto, Viaje } from '../types'
import type { Lente } from './mapa/Mapa'
import { type Destino, rendirMapa } from './mapa/rendir'

// El encuadre no se guarda: depende de lo que esté elegido (ver encuadrePorDefecto).
interface Opciones {
  formato: Formato
  /** Apagado por defecto: la imagen se comparte y no tiene por qué decir dónde vivo. */
  hogar: boolean
  fotos: boolean
}

const POR_DEFECTO: Opciones = { formato: 'cuadrado', hogar: false, fotos: false }
const CLAVE = 'periplo:exportar'

// Se recuerda por navegador, como el tema. Puede no haber localStorage (ventana privada): se usan las de siempre.
function leerOpciones(): Opciones {
  try {
    const { formato, hogar, fotos } = { ...POR_DEFECTO, ...JSON.parse(localStorage.getItem(CLAVE) ?? '{}') }
    return { formato: formato in FORMATOS ? formato : POR_DEFECTO.formato, hogar: Boolean(hogar), fotos: Boolean(fotos) }
  } catch {
    return POR_DEFECTO
  }
}

function guardarOpciones(opciones: Opciones) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(opciones))
  } catch { /* sin almacenamiento: se olvida al recargar */ }
}

const puedeCopiar = () => typeof ClipboardItem !== 'undefined' && Boolean(navigator.clipboard?.write)

interface Props {
  tema: Tema
  lente: Lente
  estados: EstadosRegiones | undefined
  resaltadas: Resaltadas
  epoca: Epoca | undefined
  fotos: Foto[] | undefined
  viaje: Viaje | undefined
  /** El mapa de la pantalla: de ahí sale "lo que estoy viendo". */
  mapa: maplibregl.Map | null
}

/** Botón y diálogo para bajar o copiar el mapa como una lámina con el estilo del tema. */
export default function Exportar({ tema, lente, estados, resaltadas, epoca, fotos, viaje, mapa }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [abierto, setAbierto] = useState(false)
  const [opciones, setOpciones] = useState(leerOpciones)
  const [lamina, setLamina] = useState<{ blob: Blob; url: string; titulo: string } | null>(null)
  const [estado, setEstado] = useState<{ tipo: 'armando' | 'error' | 'aviso'; texto: string } | null>(null)
  const estadisticas = useEstadisticas().data

  // Elegir otro viaje (o soltarlo) vuelve al encuadre que le corresponde.
  const [encuadre, setEncuadre] = useState<Encuadre>(() => encuadrePorDefecto(viaje))
  const [viajePrevio, setViajePrevio] = useState(viaje?.id)
  if (viaje?.id !== viajePrevio) {
    setViajePrevio(viaje?.id)
    setEncuadre(encuadrePorDefecto(viaje))
  }

  const codigos = useMemo(() => codigosParaEncuadre(encuadre, viaje, estados), [encuadre, viaje, estados])
  const consultaEncuadre = useEncuadre(abierto ? codigos : null)
  // Sin límites (nada que encuadrar), se copia la vista de la pantalla.
  const limites = codigos ? consultaEncuadre.data?.limites ?? null : null
  const esperandoEncuadre = abierto && Boolean(codigos) && consultaEncuadre.isPending
  const hayVisitados = Boolean(codigosParaEncuadre('visitado', viaje, estados))

  const cambiar = (parcial: Partial<Opciones>) => {
    const nuevas = { ...opciones, ...parcial }
    setOpciones(nuevas)
    guardarOpciones(nuevas)
  }

  const abrir = () => {
    setAbierto(true)
    dialogo.current?.showModal()
  }
  const cerrar = () => {
    setAbierto(false)
    dialogo.current?.close()
  }

  // Cada cambio de opciones arma la lámina de nuevo; una que termina tarde (ya se pidió otra) se descarta.
  const pedido = useRef(0)
  useEffect(() => {
    if (!abierto || !mapa || !estados || esperandoEncuadre) return
    const numero = ++pedido.current
    const reloj = setTimeout(async () => {
      setEstado({ tipo: 'armando', texto: tema.voz.cargando })
      try {
        const layout = layoutLamina(opciones.formato, tema.rasgos.lamina, tema.rasgos.rosa)
        const padding = mapa.getPadding()
        const anchoVisible = mapa.getContainer().clientWidth - (padding.left ?? 0) - (padding.right ?? 0)
        const { lng, lat } = mapa.getCenter()
        const destino: Destino = limites
          ? { limites }
          : { center: [lng, lat], zoom: zoomParaLamina(mapa.getZoom(), anchoVisible, layout.mapa.ancho / ESCALA_MAPA), bearing: mapa.getBearing() }
        const [lienzoMapa] = await Promise.all([
          rendirMapa({
            tema, lente, epoca, resaltadas, destino,
            estados: opciones.hogar ? estados : ocultarHogar(estados),
            fotos: opciones.fotos ? fotos ?? [] : [],
            ancho: layout.mapa.ancho / ESCALA_MAPA, alto: layout.mapa.alto / ESCALA_MAPA,
            densidad: DENSIDAD * ESCALA_MAPA,
          }),
          cargarFuentes(tema, layout),
        ])
        const contenido = contenidoLamina({ tema, viaje, epoca, estadisticas, mostrarHogar: opciones.hogar })
        const lienzo = dibujarLamina({
          tema, layout, contenido, mapa: lienzoMapa, densidad: DENSIDAD,
          rumbo: 'limites' in destino ? 0 : destino.bearing,
        })
        const blob = await aPng(lienzo)
        if (numero !== pedido.current) return
        setLamina({ blob, url: URL.createObjectURL(blob), titulo: contenido.titulo })
        setEstado(null)
      } catch (error) {
        if (numero !== pedido.current) return
        setEstado({ tipo: 'error', texto: error instanceof Error ? error.message : 'No se pudo armar la imagen.' })
      }
    }, 250)
    return () => clearTimeout(reloj)
  }, [abierto, mapa, estados, esperandoEncuadre, limites, opciones, tema, lente, epoca, resaltadas, fotos, viaje,
    estadisticas])

  // Al llegar otra lámina, o al desmontar, se suelta la anterior.
  useEffect(() => () => {
    if (lamina) URL.revokeObjectURL(lamina.url)
  }, [lamina])

  const descargar = () => {
    if (!lamina) return
    const enlace = document.createElement('a')
    enlace.href = lamina.url
    enlace.download = nombreArchivo(lamina.titulo, new Date())
    enlace.click()
  }

  const copiar = async () => {
    if (!lamina) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': lamina.blob })])
      setEstado({ tipo: 'aviso', texto: 'Imagen copiada: ya se puede pegar.' })
    } catch {
      setEstado({ tipo: 'error', texto: 'El navegador no dejó copiar la imagen. Probá con Descargar.' })
    }
  }

  const { ancho, alto } = FORMATOS[opciones.formato]
  const armando = estado?.tipo === 'armando' || esperandoEncuadre

  return (
    <>
      <button type="button" className="exportar-boton" onClick={abrir} disabled={!mapa}
              title="Bajar el mapa como imagen, para compartirlo">
        Exportar
      </button>
      <dialog ref={dialogo} className="confirmacion exportar" onClose={() => setAbierto(false)} aria-labelledby="exportar-titulo">
        <h2 id="exportar-titulo">Exportar el mapa</h2>
        <div className="exportar-cuerpo">
          <div className="exportar-vista" style={{ aspectRatio: `${ancho} / ${alto}` }} aria-busy={armando}>
            {lamina && <img src={lamina.url} alt={`Vista previa: ${lamina.titulo}`} className={armando ? 'armando' : ''} />}
            {armando && <p className="exportar-armando">{tema.voz.cargando}</p>}
          </div>
          <div className="exportar-opciones">
            <fieldset>
              <legend>Formato</legend>
              {(Object.keys(FORMATOS) as Formato[]).map((formato) => (
                <label key={formato}>
                  <input type="radio" name="exportar-formato" checked={opciones.formato === formato}
                         onChange={() => cambiar({ formato })} />
                  {FORMATOS[formato].nombre}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Encuadre</legend>
              <label>
                <input type="radio" name="exportar-encuadre" checked={encuadre === 'vista'}
                       onChange={() => setEncuadre('vista')} />
                Lo que estoy viendo
              </label>
              {viaje && (
                <label>
                  <input type="radio" name="exportar-encuadre" checked={encuadre === 'viaje'}
                         onChange={() => setEncuadre('viaje')} />
                  El viaje entero
                </label>
              )}
              <label>
                <input type="radio" name="exportar-encuadre" checked={encuadre === 'visitado'}
                       disabled={!hayVisitados} onChange={() => setEncuadre('visitado')} />
                Todo lo visitado
              </label>
            </fieldset>
            <fieldset>
              <legend>Mostrar</legend>
              <label>
                <input type="checkbox" checked={opciones.hogar} onChange={(e) => cambiar({ hogar: e.target.checked })} />
                Dónde viví
              </label>
              <label>
                <input type="checkbox" checked={opciones.fotos} onChange={(e) => cambiar({ fotos: e.target.checked })} />
                Fotos
              </label>
            </fieldset>
            {estado && estado.tipo !== 'armando' && (
              <p className={estado.tipo === 'error' ? 'error' : 'exportar-aviso'} role="status">{estado.texto}</p>
            )}
          </div>
        </div>
        <div className="acciones">
          <button type="button" onClick={cerrar}>Cerrar</button>
          {puedeCopiar() && <button type="button" onClick={copiar} disabled={!lamina || armando}>Copiar imagen</button>}
          <button type="button" className="activa" onClick={descargar} disabled={!lamina || armando}>Descargar PNG</button>
        </div>
      </dialog>
    </>
  )
}
