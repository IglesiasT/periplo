import { useRef } from 'react'
import { siguientePaso } from '../ciclo'
import { avisoMarca, siguienteMarca } from '../conflictos'
import type { Viaje } from '../types'
import { useActualizarVisita, useBorrarVisita, useCrearVisita, useMarcar, usePedirRegion } from './consultas'
import { useConfirmar } from './useConfirmar'

/**
 * Lo que hace un click en el mapa en modo de marcar. Con un viaje elegido, avanza un paso del ciclo de esa región en
 * el viaje. Sin viaje, avanza su marca (ver conflictos.siguienteMarca), y pregunta antes si eso pisa algo.
 */
export function useMarcarRegion(viaje: Viaje | undefined, onAviso: (aviso: string | null) => void) {
  const crear = useCrearVisita()
  const actualizar = useActualizarVisita()
  const borrar = useBorrarVisita()
  const marcar = useMarcar()
  const pedirRegion = usePedirRegion()
  const confirmar = useConfirmar()
  // Hasta que no vuelven los datos actualizados, el paso siguiente se calcularía con datos viejos:
  // un doble click crearía dos veces lo mismo. Mientras tanto, los clicks no hacen nada.
  const ocupado = useRef(false)
  const alTerminar = {
    onError: (error: Error) => onAviso(error.message),
    onSettled: () => { ocupado.current = false },
  }

  const enViaje = (viaje: Viaje, codigo: string) => {
    const accion = siguientePaso(viaje.id, viaje.visitas, codigo)
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

  const sinViaje = async (codigo: string) => {
    ocupado.current = true
    try {
      const region = await pedirRegion(codigo)
      const nueva = siguienteMarca(region)
      const aviso = avisoMarca(region, nueva)
      if (aviso && !(await confirmar(aviso))) {
        ocupado.current = false
        return
      }
      marcar.mutate({ codigo, estado: nueva }, alTerminar)
    } catch (error) {
      ocupado.current = false
      onAviso((error as Error).message)
    }
  }

  return (codigo: string) => {
    if (ocupado.current) return
    onAviso(null)
    return viaje ? enViaje(viaje, codigo) : void sinViaje(codigo)
  }
}
