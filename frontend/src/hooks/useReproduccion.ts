import { useEffect, useEffectEvent, useState } from 'react'

const TIEMPO_POR_PARADA = 1500 // milisegundos

/**
 * Recorre las paradas solas, de la actual hasta la última (el presente), y ahí frena: los años del slider de época
 * y los viajes de la repetición. El tiempo de cada parada empieza a correr cuando ya llegó lo que muestra
 * (`cargando` en falso): si la API se demora, ninguna se saltea. `alAcercarse` recibe la parada que viene, para
 * pedirla por adelantado.
 */
export function useReproduccion<T>(
  paradas: T[], actual: T, cargando: boolean, onCambiar: (parada: T) => void, alAcercarse?: (parada: T) => void,
) {
  const [reproduciendo, setReproduciendo] = useState(false)
  const indice = paradas.indexOf(actual)
  const ultima = paradas.length - 1
  const siguiente: T | undefined = paradas[indice + 1]

  const avanzar = useEffectEvent(() => {
    if (indice >= ultima) return setReproduciendo(false)
    onCambiar(paradas[indice + 1])
    if (indice + 1 === ultima) setReproduciendo(false)
  })

  useEffect(() => {
    if (!reproduciendo || cargando) return
    const temporizador = setTimeout(avanzar, TIEMPO_POR_PARADA)
    return () => clearTimeout(temporizador)
  }, [reproduciendo, cargando, actual])

  const acercarse = useEffectEvent(() => {
    if (indice < ultima) alAcercarse?.(paradas[indice + 1])
  })
  useEffect(() => {
    if (reproduciendo) acercarse()
  }, [reproduciendo, siguiente])

  const alternar = () => {
    // Desde la última no hay a dónde avanzar: arranca de nuevo desde la primera.
    if (!reproduciendo && indice === ultima) onCambiar(paradas[0])
    setReproduciendo(!reproduciendo)
  }

  return { reproduciendo, alternar, detener: () => setReproduciendo(false) }
}
