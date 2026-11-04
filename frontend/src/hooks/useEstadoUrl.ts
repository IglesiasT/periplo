import { useEffect, useState } from 'react'
import { escribirUrl, type EstadoUrl, leerUrl } from '../url'

/**
 * El estado que vive en la URL. Elegir algo agrega una entrada al historial, para que Atrás vuelva a lo
 * anterior; mover el slider o cambiar la lente reemplaza la actual, para no llenarlo de pasos.
 */
export function useEstadoUrl() {
  const [estado, setEstado] = useState(() => leerUrl(window.location.search))

  useEffect(() => {
    const alNavegar = () => setEstado(leerUrl(window.location.search))
    window.addEventListener('popstate', alNavegar)
    return () => window.removeEventListener('popstate', alNavegar)
  }, [])

  const cambiar = (cambios: Partial<EstadoUrl>, historial: 'agregar' | 'reemplazar') => {
    const nuevo = { ...estado, ...cambios }
    setEstado(nuevo)
    const { pathname, search, hash } = window.location
    const busqueda = escribirUrl(nuevo)
    if (busqueda === search) return
    const url = `${pathname}${busqueda}${hash}`
    if (historial === 'agregar') window.history.pushState(null, '', url)
    else window.history.replaceState(null, '', url)
  }

  return { ...estado, cambiar }
}
