import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

// MapLibre procesa los datos en un Web Worker que carga desde un archivo aparte.
// Con `?url` Vite copia ese archivo tal cual y nos da su URL.
maplibregl.setWorkerUrl(workerUrl)

const COLORES = {
  mar: '#1b2838',
  noVisitado: '#4a4f55',
  frontera: '#1b2838',
}

// Rectángulo [oeste, sur] - [este, norte] que encierra la Argentina continental.
const BOUNDS_ARGENTINA: [[number, number], [number, number]] = [
  [-73.6, -55.1],
  [-53.6, -21.8],
]

// Style escrito a mano: sin tiles de terceros, solo fondo + provincias.
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    provincias: {
      type: 'geojson',
      data: '/geo/argentina-provincias.geojson',
    },
  },
  layers: [
    { id: 'fondo', type: 'background', paint: { 'background-color': COLORES.mar } },
    {
      id: 'provincias-relleno',
      type: 'fill',
      source: 'provincias',
      paint: { 'fill-color': COLORES.noVisitado },
    },
    {
      id: 'provincias-frontera',
      type: 'line',
      source: 'provincias',
      paint: { 'line-color': COLORES.frontera, 'line-width': 1 },
    },
  ],
}

export default function Mapa() {
  const contenedor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const map = new maplibregl.Map({
      container: contenedor.current!,
      style: STYLE,
      bounds: BOUNDS_ARGENTINA,
      fitBoundsOptions: { padding: 40 },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }))

    return () => map.remove()
  }, [])

  return <div ref={contenedor} style={{ width: '100%', height: '100%' }} />
}
