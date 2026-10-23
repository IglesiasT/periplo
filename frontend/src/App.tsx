import { useMemo, useState } from 'react'
import { siguientePaso } from './ciclo'
import Mapa from './components/Mapa'
import Panel, { type Modo, type Seleccion } from './components/Panel'
import {
  useActualizarVisita, useBorrarVisita, useCrearRuta, useCrearVisita, useEstados, useRutas, useViajes,
} from './hooks/consultas'

export default function App() {
  const estados = useEstados()
  const viajes = useViajes()
  const rutas = useRutas()
  const [seleccion, setSeleccion] = useState<Seleccion>(null)
  const [modo, setModo] = useState<Modo>('ninguno')
  const [aviso, setAviso] = useState<string | null>(null)
  const crear = useCrearVisita()
  const actualizar = useActualizarVisita()
  const borrar = useBorrarVisita()
  const crearRuta = useCrearRuta()

  const viaje = viajes.data?.find((v) => v.id === seleccion)

  // Regiones del viaje elegido y las que las contienen: así se ve resaltado en cualquier nivel de zoom.
  const resaltadas = useMemo(
    () => new Set(viaje?.visitas.flatMap((v) => [v.region, ...v.region_ancestros]) ?? []),
    [viaje],
  )

  const seleccionar = (nueva: Seleccion) => {
    setSeleccion(nueva)
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

  const alTerminarDibujo = (coordenadas: [number, number][]) => {
    if (!viaje) return
    const numero = viaje.rutas.length + 1
    crearRuta.mutate({ viaje: viaje.id, coordenadas, nombre: `Ruta dibujada ${numero}` }, { onError: alFallar })
  }

  return (
    <div className="app">
      <Panel
        viajes={viajes.data}
        cargando={viajes.isPending}
        error={viajes.error}
        seleccion={seleccion}
        onSeleccionar={seleccionar}
        modo={modo}
        onCambiarModo={cambiarModo}
        aviso={aviso}
        onAviso={setAviso}
      />
      <Mapa
        estados={estados.data}
        resaltadas={resaltadas}
        rutas={rutas.data}
        viajeResaltado={viaje?.id ?? null}
        alClickearRegion={modo === 'marcar' && viaje ? alClickearRegion : undefined}
        alTerminarDibujo={modo === 'dibujar' && viaje ? alTerminarDibujo : undefined}
      />
    </div>
  )
}
