import type * as maplibregl from 'maplibre-gl'

// La vista se guarda en la URL (#zoom/lat/lon): al recargar no se pierde y se puede compartir un enlace a una zona.
// No se usa la opción `hash` de MapLibre porque map.remove() borra el hash, y StrictMode desmonta y vuelve
// a montar el componente en desarrollo: el segundo mapa arrancaba siempre en la vista inicial.
export const VISTA_INICIAL = { center: [-20, 10] as [number, number], zoom: 1.5 }

/** null si el hash no es una posición válida: con una latitud imposible MapLibre tira una excepción. */
export function leerVista(hash: string): typeof VISTA_INICIAL | null {
  const partes = hash.slice(1).split('/')
  if (partes.length !== 3 || partes.some((parte) => parte === '')) return null
  const [zoom, lat, lon] = partes.map(Number)
  if (![zoom, lat, lon].every(Number.isFinite) || zoom < 0 || Math.abs(lat) > 90) return null
  return { center: [lon, lat], zoom }
}

export const vistaDesdeHash = () => leerVista(window.location.hash)

export function guardarVistaEnHash(map: maplibregl.Map) {
  const { lat, lng } = map.getCenter()
  window.history.replaceState(null, '', `#${map.getZoom().toFixed(2)}/${lat.toFixed(4)}/${lng.toFixed(4)}`)
}

export interface Encuadre {
  /** [oeste, sur, este, norte], en grados. */
  limites: [number, number, number, number]
  /** Distingue dos pedidos del mismo lugar: volver a elegir el mismo viaje vuelve a acercar. */
  vez: number
}

// Al elegir un viaje, un logro o una ficha, el mapa se acerca a sus regiones, hasta este zoom como mucho
// (un departamento chico no queda pegado a los bordes).
export const ZOOM_MAXIMO_ENCUADRE = 8

// Margen alrededor de lo encuadrado: deja lugar al selector de época arriba y a los controles.
// Acotado al tamaño del mapa, porque con un margen más grande que el lienzo MapLibre no se mueve.
export function margenEncuadre(map: maplibregl.Map) {
  const { clientWidth: ancho, clientHeight: alto } = map.getContainer()
  return {
    top: Math.min(90, alto * 0.2), bottom: Math.min(40, alto * 0.1),
    left: Math.min(40, ancho * 0.1), right: Math.min(60, ancho * 0.1),
  }
}
