import { siguientePaso } from '../ciclo'
import type { Viaje } from '../types'
import { useActualizarVisita, useBorrarVisita, useCrearVisita } from './consultas'

/** Lo que hace un click en el mapa en modo de marcar: avanza un paso del ciclo de esa región en el viaje. */
export function useMarcarRegion(viaje: Viaje | undefined, onAviso: (aviso: string | null) => void) {
  const crear = useCrearVisita()
  const actualizar = useActualizarVisita()
  const borrar = useBorrarVisita()
  const alFallar = { onError: (error: Error) => onAviso(error.message) }

  return (codigo: string) => {
    if (!viaje) return
    const accion = siguientePaso(viaje.id, viaje.visitas, codigo)
    onAviso(null)
    switch (accion.tipo) {
      case 'crear':
        return crear.mutate(accion.datos, alFallar)
      case 'actualizar':
        return actualizar.mutate({ id: accion.id, datos: accion.datos }, alFallar)
      case 'borrar':
        return borrar.mutate(accion.id, alFallar)
      case 'bloqueada':
        return onAviso(accion.motivo)
    }
  }
}
