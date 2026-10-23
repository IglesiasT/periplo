import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { obtenerEstados } from '../api'
import type { EstadoRegion } from '../types'

// MapLibre procesa los datos en un Web Worker que carga desde un archivo aparte.
// Con `?url` Vite copia ese archivo tal cual y nos da su URL.
maplibregl.setWorkerUrl(workerUrl)

const COLORES = {
  mar: '#1b2838',
  noVisitado: '#4a4f55',
  fronteraPais: '#1b2838',
  fronteraProvincia: '#2f353c',
}

// De más a menos intenso; el deseo es un tono frío para que no se confunda con lo visitado.
const COLORES_ESTADO: Record<EstadoRegion, string> = {
  estadia: '#d1603d',
  paso: '#e39b62',
  transito: '#efc9a0',
  deseo: '#5d7a99',
}

const ETIQUETAS_ESTADO: Record<EstadoRegion, string> = {
  estadia: 'Estadía',
  paso: 'De paso',
  transito: 'Tránsito',
  deseo: 'Lista de deseos',
}

// Zoom semántico: alrededor de este nivel los países se desvanecen y aparecen las provincias.
const ZOOM_PROVINCIAS = 4
const FUNDIDO = 0.5 // medio nivel de zoom hacia cada lado

const SOURCES = ['paises', 'provincias'] as const

const ESTADO: ExpressionSpecification = ['coalesce', ['feature-state', 'estado'], 'ninguno']

// El color de cada región sale de su feature-state "estado"; si no tiene, queda gris (niebla de guerra).
const COLOR_RELLENO: ExpressionSpecification = [
  'match', ESTADO,
  'estadia', COLORES_ESTADO.estadia,
  'paso', COLORES_ESTADO.paso,
  'transito', COLORES_ESTADO.transito,
  'deseo', COLORES_ESTADO.deseo,
  COLORES.noVisitado,
]

// Opacidad que pasa de `desde` a `hasta` alrededor de ZOOM_PROVINCIAS. Las regiones deseadas quedan semitransparentes.
function opacidadPorZoom(desde: number, hasta: number): ExpressionSpecification {
  const conDeseo = (opacidad: number): ExpressionSpecification =>
    ['case', ['==', ESTADO, 'deseo'], opacidad * 0.6, opacidad]
  return [
    'interpolate', ['linear'], ['zoom'],
    ZOOM_PROVINCIAS - FUNDIDO, conDeseo(desde),
    ZOOM_PROVINCIAS + FUNDIDO, conDeseo(hasta),
  ]
}

// Contorno solo para las regiones de la lista de deseos.
const CONTORNO_DESEO = {
  'line-color': COLORES_ESTADO.deseo,
  'line-width': 1.5,
  'line-opacity': ['case', ['==', ESTADO, 'deseo'], 1, 0] as ExpressionSpecification,
}

// Style escrito a mano: sin tiles de terceros, solo fondo + países + provincias.
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    // promoteId: usa la propiedad "codigo" como id de cada feature, para poder darle estado.
    paises: { type: 'geojson', data: '/geo/paises.geojson', promoteId: 'codigo' },
    provincias: { type: 'geojson', data: '/geo/provincias.geojson', promoteId: 'codigo' },
  },
  layers: [
    { id: 'fondo', type: 'background', paint: { 'background-color': COLORES.mar } },

    // Provincias: aparecen al acercarse.
    {
      id: 'provincias-relleno', type: 'fill', source: 'provincias',
      minzoom: ZOOM_PROVINCIAS - FUNDIDO,
      paint: { 'fill-color': COLOR_RELLENO, 'fill-opacity': opacidadPorZoom(0, 1) },
    },
    {
      id: 'provincias-frontera', type: 'line', source: 'provincias',
      minzoom: ZOOM_PROVINCIAS - FUNDIDO,
      paint: { 'line-color': COLORES.fronteraProvincia, 'line-width': 0.75 },
    },
    {
      id: 'provincias-deseo', type: 'line', source: 'provincias',
      minzoom: ZOOM_PROVINCIAS - FUNDIDO,
      paint: CONTORNO_DESEO,
    },

    // Países: se ven de lejos y se desvanecen al acercarse. La frontera queda siempre visible.
    {
      id: 'paises-relleno', type: 'fill', source: 'paises',
      maxzoom: ZOOM_PROVINCIAS + FUNDIDO,
      paint: { 'fill-color': COLOR_RELLENO, 'fill-opacity': opacidadPorZoom(1, 0) },
    },
    // Sin maxzoom: un país deseado entero (Japón) mantiene su contorno aunque se vean las provincias.
    { id: 'paises-deseo', type: 'line', source: 'paises', paint: CONTORNO_DESEO },
    {
      id: 'paises-frontera', type: 'line', source: 'paises',
      paint: {
        'line-color': COLORES.fronteraPais,
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 6, 2],
      },
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
      center: [-20, 10],
      zoom: 1.5,
      renderWorldCopies: false,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }))

    map.on('load', async () => {
      const estados = await obtenerEstados()
      if (desmontado) return
      // Los códigos de país y de provincia no se pisan, así que alcanza con darle el estado a ambas sources.
      for (const [codigo, estado] of Object.entries(estados)) {
        for (const source of SOURCES) {
          map.setFeatureState({ source, id: codigo }, { estado })
        }
      }
    })

    // Nombre de la región al pasar el mouse: país o provincia según el zoom.
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false })
    map.on('mousemove', (e) => {
      const capa = map.getZoom() < ZOOM_PROVINCIAS ? 'paises-relleno' : 'provincias-relleno'
      const [feature] = map.queryRenderedFeatures(e.point, { layers: [capa] })
      if (!feature) {
        map.getCanvas().style.cursor = ''
        popup.remove()
        return
      }
      const estado = feature.state.estado as EstadoRegion | undefined
      const detalle = estado ? ETIQUETAS_ESTADO[estado] : 'Sin visitar'
      map.getCanvas().style.cursor = 'pointer'
      popup
        .setLngLat(e.lngLat)
        .setHTML(`<strong>${feature.properties.nombre}</strong><br>${detalle}`)
        .addTo(map)
    })
    map.getCanvas().addEventListener('mouseleave', () => popup.remove())

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
    ...(Object.keys(COLORES_ESTADO) as EstadoRegion[]).map(
      (estado): [string, string] => [ETIQUETAS_ESTADO[estado], COLORES_ESTADO[estado]],
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
