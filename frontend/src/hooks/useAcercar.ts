import { useEffect, useMemo, useRef, useState } from 'react'
import { type Encuadre, vistaDesdeHash } from '../components/mapa/vista'
import { regionesDe, type Seleccion } from '../seleccion'
import type { Logro, Viaje } from '../types'
import { useEncuadre } from './consultas'

/**
 * Adónde acercar el mapa. Se fija al elegir algo, no se recalcula con cada cambio: marcar regiones en
 * modo edición cambia las visitas del viaje y no tiene que mover el mapa.
 */
export function useAcercar(seleccion: Seleccion, viajes: Viaje[] | undefined, logros: Logro[] | undefined) {
  const [destino, setDestino] = useState<{ codigos: string[]; vez: number } | null>(null)
  const irA = (codigos: string[]) => {
    if (codigos.length) setDestino({ codigos, vez: Date.now() })
  }

  // Un enlace con algo elegido pero sin posición: se acerca a lo elegido en cuanto llegan los datos.
  const porAcercar = useRef(vistaDesdeHash() === null)
  useEffect(() => {
    if (!porAcercar.current || !viajes || !logros) return
    porAcercar.current = false
    irA(regionesDe(seleccion, viajes, logros))
  }, [seleccion, viajes, logros])

  const limites = useEncuadre(destino?.codigos ?? null).data?.limites
  const encuadre = useMemo<Encuadre | undefined>(
    () => (limites && destino ? { limites, vez: destino.vez } : undefined),
    [limites, destino],
  )

  return { encuadre, irA }
}
