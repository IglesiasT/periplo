import { useMemo, useState } from 'react'
import { siguientePaso } from './ciclo'
import Mapa from './components/Mapa'
import Panel, { type Seleccion } from './components/Panel'
import {
  useActualizarVisita, useBorrarVisita, useCrearVisita, useEstados, useViajes,
} from './hooks/consultas'

export default function App() {
  const estados = useEstados()
  const viajes = useViajes()
  const [seleccion, setSeleccion] = useState<Seleccion>(null)
  const [editando, setEditando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const crear = useCrearVisita()
  const actualizar = useActualizarVisita()
  const borrar = useBorrarVisita()

  const viaje = viajes.data?.find((v) => v.id === seleccion)

  // Regiones del viaje elegido y las que las contienen: así se ve resaltado en cualquier nivel de zoom.
  const resaltadas = useMemo(
    () => new Set(viaje?.visitas.flatMap((v) => [v.region, ...v.region_ancestros]) ?? []),
    [viaje],
  )

  const seleccionar = (nueva: Seleccion) => {
    setSeleccion(nueva)
    setEditando(false)
    setAviso(null)
  }

  const alClickearRegion = (codigo: string) => {
    if (!viaje) return
    const accion = siguientePaso(viaje.id, viaje.visitas, codigo)
    const alFallar = (error: Error) => setAviso(error.message)
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
        cargando={viajes.isPending}
        error={viajes.error}
        seleccion={seleccion}
        onSeleccionar={seleccionar}
        editando={editando}
        onEditar={setEditando}
        aviso={aviso}
      />
      <Mapa
        estados={estados.data}
        resaltadas={resaltadas}
        alClickearRegion={editando && viaje ? alClickearRegion : undefined}
      />
    </div>
  )
}
