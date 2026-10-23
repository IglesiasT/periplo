import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { obtenerEstados } from '../api'
import type { TipoPresencia } from '../types'

// MapLibre procesa los datos en un Web Worker que carga desde un archivo aparte.
// Con `?url` Vite copia ese archivo tal cual y nos da su URL.
maplibregl.setWorkerUrl(workerUrl)

const COLORES = {
  mar: '#1b2838',
  noVisitado: '#4a4f55',
  frontera: '#1b2838',
}

// Más intenso cuanto más tiempo pasé en la región.
const COLORES_PRESENCIA: Record<TipoPresencia, string> = {
  estadia: '#d1603d',
  paso: '#e39b62',
  transito: '#efc9a0',
}

const ETIQUETAS_PRESENCIA: Record<TipoPresencia, string> = {
  estadia: 'Estadía',
  paso: 'De paso',
  transito: 'Tránsito',
}

// Rectángulo [oeste, sur] - [este, norte] que encierra la Argentina continental.
const BOUNDS_ARGENTINA: [[number, number], [number, number]] = [
  [-73.6, -55.1],
  [-53.6, -21.8],
]

// El color de cada provincia sale de su feature-state "presencia"; si no tiene, queda gris.
const COLOR_RELLENO: ExpressionSpecification = [
  'match',
  ['coalesce', ['feature-state', 'presencia'], 'ninguna'],
  'estadia', COLORES_PRESENCIA.estadia,
  'paso', COLORES_PRESENCIA.paso,
  'transito', COLORES_PRESENCIA.transito,
  COLORES.noVisitado,
]

// Style escrito a mano: sin tiles de terceros, solo fondo + provincias.
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    provincias: {
      type: 'geojson',
      data: '/geo/argentina-provincias.geojson',
      // Usa la propiedad "codigo" (ISO 3166-2) como id de cada feature, para poder darle estado.
      promoteId: 'codigo',
    },
  },
  layers: [
    { id: 'fondo', type: 'background', paint: { 'background-color': COLORES.mar } },
    {
      id: 'provincias-relleno',
      type: 'fill',
      source: 'provincias',
      paint: { 'fill-color': COLOR_RELLENO },
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
    let desmontado = false
    const map = new maplibregl.Map({
      container: contenedor.current!,
      style: STYLE,
      bounds: BOUNDS_ARGENTINA,
      fitBoundsOptions: { padding: 40 },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }))

    map.on('load', async () => {
      const estados = await obtenerEstados()
      if (desmontado) return
      for (const [codigo, estado] of Object.entries(estados)) {
        map.setFeatureState({ source: 'provincias', id: codigo }, { presencia: estado })
      }
    })

    // Nombre de la provincia al pasar el mouse.
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false })
    map.on('mousemove', 'provincias-relleno', (e) => {
      const feature = e.features?.[0]
      if (!feature) return
      const presencia = feature.state.presencia as TipoPresencia | undefined
      const detalle = presencia ? ETIQUETAS_PRESENCIA[presencia] : 'Sin visitar'
      map.getCanvas().style.cursor = 'pointer'
      popup
        .setLngLat(e.lngLat)
        .setHTML(`<strong>${feature.properties.nombre}</strong><br>${detalle}`)
        .addTo(map)
    })
    map.on('mouseleave', 'provincias-relleno', () => {
      map.getCanvas().style.cursor = ''
      popup.remove()
    })

    return () => {
      desmontado = true
      map.remove()
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={contenedor} style={{ width: '100%', height: '100%' }} />
      <Leyenda />
    </div>
  )
}

function Leyenda() {
  const items: [string, string][] = [
    ...(Object.keys(COLORES_PRESENCIA) as TipoPresencia[]).map(
      (tipo): [string, string] => [ETIQUETAS_PRESENCIA[tipo], COLORES_PRESENCIA[tipo]],
    ),
    ['Sin visitar', COLORES.noVisitado],
  ]
  return (
    <div className="leyenda">
      {items.map(([etiqueta, color]) => (
        <div key={etiqueta}>
          <span className="leyenda-color" style={{ background: color }} />
          {etiqueta}
        </div>
      ))}
    </div>
  )
}
