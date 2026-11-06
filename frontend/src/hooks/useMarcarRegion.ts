import { useRef } from 'react'
import { siguientePaso } from '../ciclo'
import type { Viaje } from '../types'
import { useActualizarVisita, useBorrarVisita, useCrearVisita } from './consultas'

/** Lo que hace un click en el mapa en modo de marcar: avanza un paso del ciclo de esa región en el viaje. */
export function useMarcarRegion(viaje: Viaje | undefined, onAviso: (aviso: string | null) => void) {
  const crear = useCrearVisita()
  const actualizar = useActualizarVisita()
  const borrar = useBorrarVisita()
  // Hasta que no vuelven las visitas actualizadas, el paso siguiente se calcularía con datos viejos:
  // un doble click crearía dos veces lo mismo. Mientras tanto, los clicks no hacen nada.
  const ocupado = useRef(false)
  const alTerminar = {
    onError: (error: Error) => onAviso(error.message),
    onSettled: () => { ocupado.current = false },
  }

  return (codigo: string) => {
    if (!viaje || ocupado.current) return
    const accion = siguientePaso(viaje.id, viaje.visitas, codigo)
    onAviso(null)
    if (accion.tipo !== 'bloqueada') ocupado.current = true
    switch (accion.tipo) {
      case 'crear':
        return crear.mutate(accion.datos, alTerminar)
      case 'actualizar':
        return actualizar.mutate({ id: accion.id, datos: accion.datos }, alTerminar)
      case 'borrar':
        return borrar.mutate(accion.id, alTerminar)
      case 'bloqueada':
        return onAviso(accion.motivo)
    }
  }
}
