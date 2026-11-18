import type { Foto, Viaje } from '../types'
import FotosLista from './FotosLista'
import ViajeForm from './ViajeForm'
import VisitasLista from './VisitasLista'

interface Props {
  viaje: Viaje
  fotos: Foto[] | undefined
  onVolver: () => void
  marcando: boolean
  onCambiarMarcando: (marcando: boolean) => void
  aviso: string | null
  onAviso: (aviso: string | null) => void
}

export default function ViajeDetalle({ viaje, fotos, onVolver, marcando, onCambiarMarcando, aviso, onAviso }: Props) {
  const fotosDelViaje = fotos?.filter((f) => f.viaje === viaje.id) ?? []
  return (
    <>
      <button className="volver" onClick={onVolver}>← Viajes</button>
      <h2>{viaje.nombre}</h2>
      {/* key: si cambia el viaje elegido, el formulario se vuelve a montar con sus datos. */}
      <ViajeForm key={viaje.id} viaje={viaje} cantidadFotos={fotosDelViaje.length} onBorrado={onVolver} />
      {aviso && <p className="aviso-accion">{aviso}</p>}

      <div className="encabezado-seccion">
        <h3>Regiones</h3>
        <button className={marcando ? 'activa' : ''} onClick={() => onCambiarMarcando(!marcando)}>
          {marcando ? 'Listo' : 'Marcar en el mapa'}
        </button>
      </div>
      {marcando && (
        <p className="aviso">
          Hacé click en una región. Cada click avanza: estadía → de paso → tránsito → deseo → sin marcar.
          Marca el nivel que estás viendo: país, provincia o departamento.
        </p>
      )}
      <VisitasLista visitas={viaje.visitas} onAviso={onAviso} />

      <FotosLista viaje={viaje} fotos={fotosDelViaje} onAviso={onAviso} />
    </>
  )
}
