import { useEffect, useMemo, useRef, useState } from 'react'
import { siguientePaso } from './ciclo'
import { EntidadesPisadas, SelectorEpoca } from './components/Epoca'
import Mapa, { type Encuadre } from './components/mapa/Mapa'
import { vistaDesdeHash } from './components/mapa/vista'
import Panel, { type Modo } from './components/Panel'
import SelectorLente from './components/SelectorLente'
import {
  useActualizarVisita, useAniosHistoricos, useBorrarVisita, useCrearVisita, useEncuadre, useEpoca, useEstados,
  useFotos, useLogros, useViajes,
} from './hooks/consultas'
import { useEstadoUrl } from './hooks/useEstadoUrl'
import { regionesDe, resaltadasDe, type Seleccion, viajeElegido } from './seleccion'
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
  const [modo, setModo] = useState<Modo>('ninguno')
  const [aviso, setAviso] = useState<string | null>(null)
  const crear = useCrearVisita()
  const actualizar = useActualizarVisita()
  const borrar = useBorrarVisita()

  const viaje = viajeElegido(seleccion, viajes.data)
  const resaltadas = useMemo(
    () => resaltadasDe(seleccion, viajes.data, logros.data),
    [seleccion, viajes.data, logros.data],
  )

  // Adónde acercar el mapa. Se fija al elegir algo, no se recalcula con cada cambio: marcar regiones en
  // modo edición cambia las visitas del viaje y no tiene que mover el mapa.
  const [destino, setDestino] = useState<{ codigos: string[]; vez: number } | null>(null)
  const irA = (codigos: string[]) => {
    if (codigos.length) setDestino({ codigos, vez: Date.now() })
  }
  // Un enlace con algo elegido pero sin posición: se acerca a lo elegido en cuanto llegan los datos.
  const porAcercar = useRef(vistaDesdeHash() === null)
  useEffect(() => {
    if (!porAcercar.current || !viajes.data || !logros.data) return
    porAcercar.current = false
    irA(regionesDe(seleccion, viajes.data, logros.data))
  }, [seleccion, viajes.data, logros.data])

  const limites = useEncuadre(destino?.codigos ?? null).data?.limites
  const encuadre = useMemo<Encuadre | undefined>(
    () => (limites && destino ? { limites, vez: destino.vez } : undefined),
    [limites, destino],
  )

  /** `acercar: false` para lo que se elige haciendo click en el mapa: ya se está mirando ahí. */
  const seleccionar = (nueva: Seleccion, { acercar = true } = {}) => {
    cambiar({ seleccion: nueva }, 'agregar')
    if (acercar) irA(regionesDe(nueva, viajes.data, logros.data))
  }

  // Cambiar de selección, también con Atrás, termina el modo de marcar: no se marca en otro viaje sin querer.
  const [seleccionPrevia, setSeleccionPrevia] = useState(seleccion)
  if (seleccion !== seleccionPrevia) {
    setSeleccionPrevia(seleccion)
    setModo('ninguno')
    setAviso(null)
  }

  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo)
    setAviso(null)
  }

  const alFallar = (error: Error) => setAviso(error.message)

  const alClickearRegion = (codigo: string) => {
    if (!viaje) return
    const accion = siguientePaso(viaje.id, viaje.visitas, codigo)
    setAviso(null)
    switch (accion.tipo) {
      case 'crear':
        return crear.mutate(accion.datos, { onError: alFallar })
      case 'actualizar':
        return actualizar.mutate({ id: accion.id, datos: accion.datos }, { onError: alFallar })
      case 'borrar':
        return borrar.mutate(accion.id, { onError: alFallar })
      case 'bloqueada':
        return setAviso(accion.motivo)
    }
  }

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
        modo={modo}
        onCambiarModo={cambiarModo}
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
        alClickearRegion={modo === 'marcar' && viaje ? alClickearRegion : undefined}
        alElegirRegion={(codigo) => seleccionar({ tipo: 'region', codigo }, { acercar: false })}
        fotos={fotos.data}
        epoca={epoca}
      >
        <div className="controles-mapa">
          {/* Sin años cruzados (no se corrió cruzar_historia) no hay nada que elegir. */}
          {anios.data && anios.data.length > 0 && <SelectorEpoca anios={anios.data} anio={anio} onCambiar={(nuevo) => cambiar({ anio: nuevo }, 'reemplazar')} />}
          <SelectorLente lente={lente} onCambiar={(nueva) => cambiar({ lente: nueva }, 'reemplazar')} />
        </div>
        {epoca && <EntidadesPisadas epoca={epoca} />}
      </Mapa>
    </div>
  )
}
