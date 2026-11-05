import { useMemo, useState } from 'react'
import { EntidadesPisadas, SelectorEpoca } from './components/Epoca'
import Mapa from './components/mapa/Mapa'
import Panel from './components/Panel'
import SelectorLente from './components/SelectorLente'
import {
  useAniosHistoricos, useEpoca, useEstados, useFichas, useFotos, useLogros, useReintentarFallidas, useViajes,
} from './hooks/consultas'
import { useAcercar } from './hooks/useAcercar'
import { useEstadoUrl } from './hooks/useEstadoUrl'
import { useMarcarRegion } from './hooks/useMarcarRegion'
import { abrirFicha, regionesDe, resaltadasDe, type Seleccion, viajeElegido } from './seleccion'
import { useTema } from './tema/contexto'

export default function App() {
  const { tema } = useTema()
  const estados = useEstados()
  const viajes = useViajes()
  const fotos = useFotos()
  const logros = useLogros()
  const anios = useAniosHistoricos()
  const { anio: anioUrl, lente, seleccion, cambiar } = useEstadoUrl()
  // Un año que no tiene snapshot (un enlace viejo, una URL escrita a mano) es el presente.
  const anio = anioUrl !== null && anios.data?.includes(anioUrl) ? anioUrl : null
  const epocaConsulta = useEpoca(anio)
  // Al volver al presente la consulta queda deshabilitada pero conserva el último año como placeholder.
  const epoca = anio === null ? undefined : epocaConsulta.data
  const [marcando, setMarcando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const viaje = viajeElegido(seleccion, viajes.data)
  const alClickearRegion = useMarcarRegion(viaje, setAviso)
  const respuestaFichas = useFichas().data
  const fichas = useMemo(() => new Set(respuestaFichas?.map((f) => f.codigo)), [respuestaFichas])
  const resaltadas = useMemo(
    () => resaltadasDe(seleccion, viajes.data, logros.data),
    [seleccion, viajes.data, logros.data],
  )

  const { encuadre, irA } = useAcercar(seleccion, viajes.data, logros.data)

  /** `acercar: false` para lo que se elige haciendo click en el mapa (ya se está mirando ahí) o no lleva a ningún lado. */
  const seleccionar = (nueva: Seleccion, { acercar = true } = {}) => {
    cambiar({ seleccion: nueva }, 'agregar')
    if (acercar) irA(regionesDe(nueva, viajes.data, logros.data))
  }

  // Cambiar de selección, también con Atrás, termina el modo de marcar: no se marca en otro viaje sin querer.
  const [seleccionPrevia, setSeleccionPrevia] = useState(seleccion)
  if (seleccion !== seleccionPrevia) {
    setSeleccionPrevia(seleccion)
    setMarcando(false)
    setAviso(null)
  }

  const cambiarMarcando = (nuevo: boolean) => {
    setMarcando(nuevo)
    setAviso(null)
  }

  // Sin estos datos el mapa queda mudo, sin explicar por qué: se avisa encima de él.
  const consultaFallida = [estados, fotos, logros, anios, epocaConsulta].find((consulta) => consulta.error)
  const reintentarFallidas = useReintentarFallidas()

  return (
    <div className="app">
      <Panel
        viajes={viajes.data}
        fotos={fotos.data}
        logros={logros.data}
        cargando={viajes.isPending}
        error={viajes.error}
        seleccion={seleccion}
        onSeleccionar={seleccionar}
        marcando={marcando}
        onCambiarMarcando={cambiarMarcando}
        aviso={aviso}
        onAviso={setAviso}
      />
      {/* Otro tema, otro mapa: el estilo de MapLibre se arma una vez, con los colores del tema. */}
      <Mapa
        key={tema.id}
        tema={tema}
        lente={lente}
        estados={estados.data}
        resaltadas={resaltadas}
        encuadre={encuadre}
        alClickearRegion={marcando && viaje ? alClickearRegion : undefined}
        alElegirRegion={(codigo) => seleccionar(abrirFicha(seleccion, codigo), { acercar: false })}
        fichas={fichas}
        fotos={fotos.data}
        epoca={epoca}
      >
        <div className="controles-mapa">
          {consultaFallida?.error && (
            <div className="aviso-datos" role="alert">
              <span>No se pudieron cargar los datos del mapa: {consultaFallida.error.message}</span>
              <button onClick={reintentarFallidas}>Reintentar</button>
            </div>
          )}
          {/* Sin años cruzados (no se corrió cruzar_historia) no hay nada que elegir. */}
          {anios.data && anios.data.length > 0 && (
            <SelectorEpoca anios={anios.data} anio={anio} onCambiar={(nuevo) => cambiar({ anio: nuevo }, 'reemplazar')} />
          )}
          <SelectorLente lente={lente} onCambiar={(nueva) => cambiar({ lente: nueva }, 'reemplazar')} />
        </div>
        {epoca && <EntidadesPisadas epoca={epoca} />}
      </Mapa>
    </div>
  )
}
