import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api'
import type { DatosViaje, DatosVisita, Ruta } from '../types'

// Cada dato de la API tiene una clave en la caché de TanStack Query.
const CLAVES = {
  estados: ['estados'],
  viajes: ['viajes'],
  estadisticas: ['estadisticas'],
  rutas: ['rutas'],
  fotos: ['fotos'],
} as const

export const useEstados = () => useQuery({ queryKey: CLAVES.estados, queryFn: api.obtenerEstados })

export const useEstadisticas = () => useQuery({ queryKey: CLAVES.estadisticas, queryFn: api.obtenerEstadisticas })

export const useRutas = () => useQuery({ queryKey: CLAVES.rutas, queryFn: api.listarRutas })

export const useFotos = () => useQuery({ queryKey: CLAVES.fotos, queryFn: api.listarFotos })

export const useViajes = () => useQuery({ queryKey: CLAVES.viajes, queryFn: api.listarViajes })

/** Cualquier cambio en viajes o visitas puede cambiar el color del mapa y las estadísticas:
 *  se invalidan todas las claves y TanStack Query las vuelve a pedir. */
function useInvalidar() {
  const cliente = useQueryClient()
  return () => Promise.all(Object.values(CLAVES).map((queryKey) => cliente.invalidateQueries({ queryKey })))
}

export function useGuardarViaje() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: ({ id, datos }: { id?: number; datos: DatosViaje }) =>
      id === undefined ? api.crearViaje(datos) : api.actualizarViaje(id, datos),
    onSuccess: invalidar,
  })
}

export function useBorrarViaje() {
  const invalidar = useInvalidar()
  return useMutation({ mutationFn: api.borrarViaje, onSuccess: invalidar })
}

export function useCrearVisita() {
  const invalidar = useInvalidar()
  return useMutation({ mutationFn: (datos: DatosVisita) => api.crearVisita(datos), onSuccess: invalidar })
}

export function useActualizarVisita() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: Partial<DatosVisita> }) => api.actualizarVisita(id, datos),
    onSuccess: invalidar,
  })
}

export function useBorrarVisita() {
  const invalidar = useInvalidar()
  return useMutation({ mutationFn: api.borrarVisita, onSuccess: invalidar })
}

export function useCrearRuta() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (datos: Pick<Ruta, 'viaje' | 'coordenadas'> & { nombre?: string }) => api.crearRuta(datos),
    onSuccess: invalidar,
  })
}

export function useImportarRutas() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: ({ viaje, archivo }: { viaje: number; archivo: File }) => api.importarRutas(viaje, archivo),
    onSuccess: invalidar,
  })
}

export function useBorrarRuta() {
  const invalidar = useInvalidar()
  return useMutation({ mutationFn: api.borrarRuta, onSuccess: invalidar })
}

export function useMarcarTransito() {
  const invalidar = useInvalidar()
  return useMutation({ mutationFn: api.marcarTransito, onSuccess: invalidar })
}

export function useSubirFoto() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: ({ viaje, archivo }: { viaje: number; archivo: File }) => api.subirFoto(viaje, archivo),
    onSuccess: invalidar,
  })
}

export function useBorrarFoto() {
  const invalidar = useInvalidar()
  return useMutation({ mutationFn: api.borrarFoto, onSuccess: invalidar })
}
