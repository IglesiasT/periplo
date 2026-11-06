import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api'
import type { DatosViaje, DatosVisita } from '../types'

// Cada dato de la API tiene una clave en la caché de TanStack Query.
const CLAVES = {
  estados: ['estados'],
  viajes: ['viajes'],
  visitasSueltas: ['visitas-sueltas'],
  estadisticas: ['estadisticas'],
  logros: ['logros'],
  fotos: ['fotos'],
  // Prefijo de los años disponibles y de cada época: invalidarlo recalcula las entidades pisadas.
  historia: ['historia'],
  // Prefijo del detalle de cada región: sus visitas cambian con cualquier visita.
  regiones: ['regiones'],
  fichas: ['fichas'],
} as const

export const useEstados = () => useQuery({ queryKey: CLAVES.estados, queryFn: api.obtenerEstados })

export const useAniosHistoricos = () =>
  useQuery({ queryKey: [...CLAVES.historia, 'anios'], queryFn: api.obtenerAniosHistoricos })

/** El mapa en `anio`, o nada si es null (el presente). Al mover el slider se sigue viendo el año
 *  anterior hasta que llega el nuevo, en lugar de parpadear al color del presente. */
export const useEpoca = (anio: number | null) =>
  useQuery({
    queryKey: [...CLAVES.historia, anio],
    queryFn: () => api.obtenerEpoca(anio!),
    enabled: anio !== null,
    placeholderData: keepPreviousData,
    // Solo cambia con las visitas, y cualquier cambio en ellas invalida esta clave (ver useInvalidar).
    staleTime: Infinity,
  })

export function usePedirEpocaPorAdelantado() {
  const cliente = useQueryClient()
  return (anio: number) => void cliente.prefetchQuery({
    queryKey: [...CLAVES.historia, anio],
    queryFn: () => api.obtenerEpoca(anio),
    staleTime: Infinity,
  })
}

export const useEstadisticas = () => useQuery({ queryKey: CLAVES.estadisticas, queryFn: api.obtenerEstadisticas })

export const useLogros = () => useQuery({ queryKey: CLAVES.logros, queryFn: api.obtenerLogros })

export const useRegion = (codigo: string | null) =>
  useQuery({
    queryKey: [...CLAVES.regiones, codigo],
    queryFn: () => api.obtenerRegion(codigo!),
    enabled: codigo !== null,
  })

/** Fuera de CLAVES a propósito: el recuadro de una región no cambia con las visitas, no hace falta invalidarlo. */
export const useEncuadre = (codigos: string[] | null) =>
  useQuery({
    queryKey: ['encuadre', ...(codigos ?? [])],
    queryFn: () => api.obtenerEncuadre(codigos!),
    enabled: Boolean(codigos?.length),
    staleTime: Infinity,
  })

export const useFichas = () => useQuery({ queryKey: CLAVES.fichas, queryFn: api.listarFichas })

export function useGuardarFicha() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: ({ codigo, texto }: { codigo: string; texto: string }) => api.guardarFicha(codigo, texto),
    onSuccess: invalidar,
  })
}

export const useFotos = () => useQuery({ queryKey: CLAVES.fotos, queryFn: api.listarFotos })

export const useVisitasSueltas = () => useQuery({ queryKey: CLAVES.visitasSueltas, queryFn: api.listarVisitasSueltas })

export const useViajes = () => useQuery({ queryKey: CLAVES.viajes, queryFn: api.listarViajes })

/** Vuelve a pedir todo lo que falló, y solo eso: una consulta deshabilitada (la época, en el presente) no se toca. */
export function useReintentarFallidas() {
  const cliente = useQueryClient()
  return () => void cliente.refetchQueries({ predicate: (consulta) => consulta.state.status === 'error' })
}

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
