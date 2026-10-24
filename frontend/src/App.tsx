import { useMemo, useState } from 'react'
import { siguientePaso } from './ciclo'
import { EntidadesPisadas, SelectorEpoca } from './components/Epoca'
import Mapa, { type Encuadre, type Lente } from './components/mapa/Mapa'
import Panel, { type Modo, type Seleccion } from './components/Panel'
import SelectorLente from './components/SelectorLente'
import {
  useActualizarVisita, useAniosHistoricos, useBorrarVisita, useCrearVisita, useEncuadre, useEpoca, useEstados,
  useFotos, useLogros, useViajes,
} from './hooks/consultas'
import { regionesAEncuadrar, resaltarRegiones, resaltarViaje } from './resaltado'
import { useTema } from './tema/contexto'

export default function App() {
  const { tema } = useTema()
  const estados = useEstados()
  const viajes = useViajes()
  const fotos = useFotos()
  const logros = useLogros()
  const anios = useAniosHistoricos()
  // null = el presente.
  const [anio, setAnio] = useState<number | null>(null)
  const [lente, setLente] = useState<Lente>('automatica')
  const epocaConsulta = useEpoca(anio)
  // Al volver al presente la consulta queda deshabilitada pero conserva el último año como placeholder.
  const epoca = anio === null ? undefined : epocaConsulta.data
  const [seleccion, setSeleccion] = useState<Seleccion>(null)
  const [logroElegido, setLogroElegido] = useState<string | null>(null)
  const [modo, setModo] = useState<Modo>('ninguno')
  const [aviso, setAviso] = useState<string | null>(null)
  const crear = useCrearVisita()
  const actualizar = useActualizarVisita()
  const borrar = useBorrarVisita()

  const viaje = viajes.data?.find((v) => v.id === seleccion)
  const logro = seleccion === 'logros' ? logros.data?.find((l) => l.id === logroElegido) : undefined
  const regionElegida = typeof seleccion === 'object' && seleccion !== null ? seleccion.region : null

  // Las regiones del viaje elegido (y las que las contienen, para verlo de lejos); con un logro desplegado,
  // las de todos sus objetivos, cumplidos o no; con una ficha abierta, su región.
  const resaltadas = useMemo(() => {
    if (logro) return resaltarRegiones(logro.objetivos.flatMap((o) => o.regiones))
    if (regionElegida) return resaltarRegiones([regionElegida])
    return resaltarViaje(viaje?.visitas ?? [])
  }, [viaje, logro, regionElegida])

  // Adónde acercar el mapa. Se fija al elegir algo, no se recalcula con cada cambio: marcar regiones en
  // modo edición cambia las visitas del viaje y no tiene que mover el mapa.
  const [destino, setDestino] = useState<{ codigos: string[]; vez: number } | null>(null)
  const irA = (codigos: string[]) => {
    if (codigos.length) setDestino({ codigos, vez: Date.now() })
  }
  const limites = useEncuadre(destino?.codigos ?? null).data?.limites
  const encuadre = useMemo<Encuadre | undefined>(
    () => (limites && destino ? { limites, vez: destino.vez } : undefined),
    [limites, destino],
  )

  /** `acercar: false` para lo que se elige haciendo click en el mapa: ya se está mirando ahí. */
  const seleccionar = (nueva: Seleccion, { acercar = true } = {}) => {
    setSeleccion(nueva)
    setLogroElegido(null)
    setModo('ninguno')
    setAviso(null)
    if (!acercar) return
    if (typeof nueva === 'number') {
      irA(regionesAEncuadrar(resaltarViaje(viajes.data?.find((v) => v.id === nueva)?.visitas ?? [])))
    } else if (typeof nueva === 'object' && nueva !== null) {
      irA([nueva.region])
    }
  }

  const elegirLogro = (id: string | null) => {
    setLogroElegido(id)
    const elegido = logros.data?.find((l) => l.id === id)
    if (elegido) irA(elegido.objetivos.flatMap((o) => o.regiones))
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
        logroElegido={logroElegido}
        onElegirLogro={elegirLogro}
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
        alElegirRegion={(codigo) => seleccionar({ region: codigo }, { acercar: false })}
        fotos={fotos.data}
        epoca={epoca}
      >
        <div className="controles-mapa">
          {/* Sin años cruzados (no se corrió cruzar_historia) no hay nada que elegir. */}
          {anios.data && anios.data.length > 0 && <SelectorEpoca anios={anios.data} anio={anio} onCambiar={setAnio} />}
          <SelectorLente lente={lente} onCambiar={setLente} />
        </div>
        {epoca && <EntidadesPisadas epoca={epoca} />}
      </Mapa>
    </div>
  )
}
