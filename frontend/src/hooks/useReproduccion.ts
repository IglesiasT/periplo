import { useEffect, useEffectEvent, useState } from 'react'
import { type Parada, paradaSiguiente } from '../paradas'
import { usePedirEpocaPorAdelantado } from './consultas'

const TIEMPO_POR_ANIO = 1500 // milisegundos

/**
 * El mapa recorre los años solo, de la parada actual hasta el presente. El tiempo de cada año empieza a correr
 * cuando su mapa ya llegó (`cargando` en falso): si la API se demora, ningún año se saltea.
 */
export function useReproduccion(paradas: Parada[], actual: Parada, cargando: boolean, onCambiar: (parada: Parada) => void) {
  const [reproduciendo, setReproduciendo] = useState(false)
  const siguiente = paradaSiguiente(paradas, actual)

  const avanzar = useEffectEvent(() => {
    if (siguiente === undefined) return setReproduciendo(false)
    onCambiar(siguiente)
    if (siguiente === null) setReproduciendo(false)
  })

  useEffect(() => {
    if (!reproduciendo || cargando) return
    const temporizador = setTimeout(avanzar, TIEMPO_POR_ANIO)
    return () => clearTimeout(temporizador)
  }, [reproduciendo, cargando, actual])

  // Para que el año siguiente ya esté acá cuando le toque.
  const pedirPorAdelantado = usePedirEpocaPorAdelantado()
  const pedirSiguiente = useEffectEvent(() => {
    if (siguiente !== undefined && siguiente !== null) pedirPorAdelantado(siguiente)
  })
  useEffect(() => {
    if (reproduciendo) pedirSiguiente()
  }, [reproduciendo, siguiente])

  const alternar = () => {
    // Desde el presente no hay a dónde avanzar: arranca de nuevo desde la primera parada.
    if (!reproduciendo && actual === null) onCambiar(paradas[0])
    setReproduciendo(!reproduciendo)
  }

  return { reproduciendo, alternar, detener: () => setReproduciendo(false) }
}
