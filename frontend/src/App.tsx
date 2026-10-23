import { useMemo, useState } from 'react'
import Mapa from './components/Mapa'
import Panel, { type Seleccion } from './components/Panel'
import { useEstados, useViajes } from './hooks/consultas'

export default function App() {
  const estados = useEstados()
  const viajes = useViajes()
  const [seleccion, setSeleccion] = useState<Seleccion>(null)

  // Regiones del viaje elegido y las que las contienen: así se ve resaltado en cualquier nivel de zoom.
  const resaltadas = useMemo(() => {
    const viaje = viajes.data?.find((v) => v.id === seleccion)
    return new Set(viaje?.visitas.flatMap((v) => [v.region, ...v.region_ancestros]) ?? [])
  }, [viajes.data, seleccion])

  return (
    <div className="app">
      <Panel
        viajes={viajes.data}
        cargando={viajes.isPending}
        error={viajes.error}
        seleccion={seleccion}
        onSeleccionar={setSeleccion}
      />
      <Mapa estados={estados.data} resaltadas={resaltadas} />
    </div>
  )
}
