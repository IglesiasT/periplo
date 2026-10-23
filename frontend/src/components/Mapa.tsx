import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { EstadoRegion, EstadosRegiones } from '../types'

// MapLibre procesa los datos en un Web Worker que carga desde un archivo aparte.
// Con `?url` Vite copia ese archivo tal cual y nos da su URL.
maplibregl.setWorkerUrl(workerUrl)

const COLORES = {
  mar: '#1b2838',
  noVisitado: '#4a4f55',
  fronteraPais: '#1b2838',
  fronteraProvincia: '#2f353c',
  resaltado: '#f4efe6',
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

// Zoom semántico, como el mapa de estados de Victoria 3:
// países -> provincias alrededor de ZOOM_PROVINCIAS, y provincias argentinas -> departamentos alrededor de ZOOM_DEPARTAMENTOS.
const ZOOM_PROVINCIAS = 4
const ZOOM_DEPARTAMENTOS = 7
const FUNDIDO = 0.5 // medio nivel de zoom hacia cada lado

const SOURCES = ['paises', 'provincias', 'departamentos'] as const

const ESTADO: ExpressionSpecification = ['coalesce', ['feature-state', 'estado'], 'ninguno']
const RESALTADA: ExpressionSpecification = ['boolean', ['feature-state', 'resaltada'], false]

// Provincias con un nivel más detallado debajo (por ahora, solo las argentinas del IGN).
const TIENE_DEPARTAMENTOS: ExpressionSpecification = ['==', ['get', 'padre'], 'ARG']

// El color de cada región sale de su feature-state "estado"; si no tiene, queda gris (niebla de guerra).
const COLOR_RELLENO: ExpressionSpecification = [
  'match', ESTADO,
  'estadia', COLORES_ESTADO.estadia,
  'paso', COLORES_ESTADO.paso,
  'transito', COLORES_ESTADO.transito,
  'deseo', COLORES_ESTADO.deseo,
  COLORES.noVisitado,
]

// Las regiones deseadas quedan semitransparentes.
const FACTOR_DESEO: ExpressionSpecification = ['case', ['==', ESTADO, 'deseo'], 0.6, 1]

type Valor = number | ExpressionSpecification

// Opacidad que interpola entre paradas [zoom, valor]: así se hace el fundido entre niveles.
function opacidadPorZoom(...paradas: [number, Valor][]): ExpressionSpecification {
  const valores = paradas.flatMap(([zoom, valor]) => [zoom, ['*', valor, FACTOR_DESEO]])
  return ['interpolate', ['linear'], ['zoom'], ...valores] as unknown as ExpressionSpecification
}

// Contorno solo para las regiones de la lista de deseos.
const CONTORNO_DESEO = {
  'line-color': COLORES_ESTADO.deseo,
  'line-width': 1.5,
  'line-opacity': ['case', ['==', ESTADO, 'deseo'], 1, 0] as ExpressionSpecification,
}

const ATRIBUCION_NE = '<a href="https://www.naturalearthdata.com/">Natural Earth</a>'
// Requerida por la licencia del IGN: fuente y fecha de los datos originales.
const ATRIBUCION_IGN =
  'FUENTE: <a href="https://www.ign.gob.ar/">Instituto Geográfico Nacional de la República Argentina</a> (límites al 11/11/2019)'

// Style escrito a mano: sin tiles de terceros, solo fondo + países + provincias + departamentos.
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    // promoteId: usa la propiedad "codigo" como id de cada feature, para poder darle estado.
    paises: { type: 'geojson', data: '/geo/paises.geojson', promoteId: 'codigo', attribution: ATRIBUCION_NE },
    provincias: { type: 'geojson', data: '/geo/provincias.geojson', promoteId: 'codigo', attribution: ATRIBUCION_NE },
    departamentos: {
      type: 'geojson', data: '/geo/departamentos.geojson', promoteId: 'codigo', attribution: ATRIBUCION_IGN,
    },
  },
  layers: [
    { id: 'fondo', type: 'background', paint: { 'background-color': COLORES.mar } },

    // Provincias: aparecen al acercarse; las argentinas se vuelven a desvanecer cuando llegan los departamentos.
    {
      id: 'provincias-relleno', type: 'fill', source: 'provincias',
      minzoom: ZOOM_PROVINCIAS - FUNDIDO,
      paint: {
        'fill-color': COLOR_RELLENO,
        'fill-opacity': opacidadPorZoom(
          [ZOOM_PROVINCIAS - FUNDIDO, 0],
          [ZOOM_PROVINCIAS + FUNDIDO, 1],
          [ZOOM_DEPARTAMENTOS - FUNDIDO, 1],
          [ZOOM_DEPARTAMENTOS + FUNDIDO, ['case', TIENE_DEPARTAMENTOS, 0, 1]],
        ),
      },
    },

    // Departamentos (solo Argentina): aparecen al acercarse más.
    {
      id: 'departamentos-relleno', type: 'fill', source: 'departamentos',
      minzoom: ZOOM_DEPARTAMENTOS - FUNDIDO,
      paint: {
        'fill-color': COLOR_RELLENO,
        'fill-opacity': opacidadPorZoom([ZOOM_DEPARTAMENTOS - FUNDIDO, 0], [ZOOM_DEPARTAMENTOS + FUNDIDO, 1]),
      },
    },
    {
      id: 'departamentos-frontera', type: 'line', source: 'departamentos',
      minzoom: ZOOM_DEPARTAMENTOS - FUNDIDO,
      paint: { 'line-color': COLORES.fronteraProvincia, 'line-width': 0.75 },
    },
    {
      id: 'departamentos-deseo', type: 'line', source: 'departamentos',
      minzoom: ZOOM_DEPARTAMENTOS - FUNDIDO,
      paint: CONTORNO_DESEO,
    },

    {
      id: 'provincias-frontera', type: 'line', source: 'provincias',
      minzoom: ZOOM_PROVINCIAS - FUNDIDO,
      paint: {
        'line-color': COLORES.fronteraProvincia,
        'line-width': 0.75,
        // Las fronteras de Natural Earth no coinciden exacto con las del IGN: con departamentos se ocultan.
        'line-opacity': [
          'interpolate', ['linear'], ['zoom'],
          ZOOM_DEPARTAMENTOS - FUNDIDO, 1,
          ZOOM_DEPARTAMENTOS + FUNDIDO, ['case', TIENE_DEPARTAMENTOS, 0, 1],
        ],
      },
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
      paint: {
        'fill-color': COLOR_RELLENO,
        'fill-opacity': opacidadPorZoom([ZOOM_PROVINCIAS - FUNDIDO, 1], [ZOOM_PROVINCIAS + FUNDIDO, 0]),
      },
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

    // Contorno claro de las regiones del viaje elegido en el panel (feature-state "resaltada").
    {
      id: 'departamentos-resaltada', type: 'line', source: 'departamentos',
      minzoom: ZOOM_DEPARTAMENTOS - FUNDIDO,
      paint: { 'line-color': COLORES.resaltado, 'line-width': 2, 'line-opacity': ['case', RESALTADA, 1, 0] },
    },
    {
      id: 'provincias-resaltada', type: 'line', source: 'provincias',
      minzoom: ZOOM_PROVINCIAS - FUNDIDO,
      paint: {
        'line-color': COLORES.resaltado,
        'line-width': 2,
        'line-opacity': [
          'interpolate', ['linear'], ['zoom'],
          ZOOM_DEPARTAMENTOS - FUNDIDO, ['case', RESALTADA, 1, 0],
          ZOOM_DEPARTAMENTOS + FUNDIDO, ['case', RESALTADA, ['case', TIENE_DEPARTAMENTOS, 0, 1], 0],
        ],
      },
    },
    {
      id: 'paises-resaltada', type: 'line', source: 'paises',
      maxzoom: ZOOM_PROVINCIAS + FUNDIDO,
      paint: { 'line-color': COLORES.resaltado, 'line-width': 2, 'line-opacity': ['case', RESALTADA, 1, 0] },
    },
  ],
}

// La vista se guarda en la URL (#zoom/lat/lon): al recargar no se pierde y se puede compartir un enlace a una zona.
// No se usa la opción `hash` de MapLibre porque map.remove() borra el hash, y StrictMode desmonta y vuelve
// a montar el componente en desarrollo: el segundo mapa arrancaba siempre en la vista inicial.
const VISTA_INICIAL = { center: [-20, 10] as [number, number], zoom: 1.5 }

function vistaDesdeHash(): typeof VISTA_INICIAL | null {
  const [zoom, lat, lon] = window.location.hash.slice(1).split('/').map(Number)
  if ([zoom, lat, lon].some((n) => n === undefined || Number.isNaN(n))) return null
  return { center: [lon, lat], zoom }
}

function guardarVistaEnHash(map: maplibregl.Map) {
  const { lat, lng } = map.getCenter()
  window.history.replaceState(null, '', `#${map.getZoom().toFixed(2)}/${lat.toFixed(4)}/${lng.toFixed(4)}`)
}

// Capas donde buscar la región bajo el mouse, de la más detallada a la menos, según el zoom.
function capasConsultables(zoom: number): string[] {
  if (zoom < ZOOM_PROVINCIAS) return ['paises-relleno']
  if (zoom < ZOOM_DEPARTAMENTOS) return ['provincias-relleno']
  return ['departamentos-relleno', 'provincias-relleno']
}

// Los códigos de país, provincia y departamento no se pisan: alcanza con darle el estado a todas las sources.
function aplicarFeatureState(map: maplibregl.Map, codigo: string, estado: Record<string, unknown>) {
  for (const source of SOURCES) map.setFeatureState({ source, id: codigo }, estado)
}

interface Props {
  /** Estado de cada región visitada o deseada (de /api/estados/). */
  estados: EstadosRegiones | undefined
  /** Códigos de las regiones a destacar con un contorno claro (las del viaje elegido). */
  resaltadas: Set<string>
}

export default function Mapa({ estados, resaltadas }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  // `listo` es estado (no ref) para que los efectos de abajo se vuelvan a correr cuando el mapa termina de cargar.
  const [listo, setListo] = useState(false)
  // Lo que ya está aplicado en el mapa actual, para calcular la diferencia en cada cambio.
  const estadosAplicados = useRef<EstadosRegiones>({})
  const resaltadasAplicadas = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Mapa nuevo (StrictMode monta dos veces en desarrollo): todavía no tiene nada pintado.
    estadosAplicados.current = {}
    resaltadasAplicadas.current = new Set()
    const map = new maplibregl.Map({
      container: contenedor.current!,
      style: STYLE,
      ...(vistaDesdeHash() ?? VISTA_INICIAL),
      renderWorldCopies: false,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }))
    map.on('moveend', () => guardarVistaEnHash(map))
    map.on('load', () => setListo(true))

    // Nombre de la región al pasar el mouse: país, provincia o departamento según el zoom.
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false })
    map.on('mousemove', (e) => {
      // queryRenderedFeatures devuelve primero la capa de más arriba: el departamento si lo hay.
      const [feature] = map.queryRenderedFeatures(e.point, { layers: capasConsultables(map.getZoom()) })
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
      map.remove()
      mapRef.current = null
      setListo(false)
    }
  }, [])

  // React es declarativo ("el mapa tiene estos estados") y MapLibre imperativo ("pintá esta región"):
  // cada vez que cambian las props se aplica solo la diferencia con lo que ya está pintado.
  useEffect(() => {
    const map = mapRef.current
    if (!listo || !map || !estados) return
    for (const codigo of Object.keys(estadosAplicados.current)) {
      if (!(codigo in estados)) aplicarFeatureState(map, codigo, { estado: null })
    }
    for (const [codigo, estado] of Object.entries(estados)) {
      if (estadosAplicados.current[codigo] !== estado) aplicarFeatureState(map, codigo, { estado })
    }
    estadosAplicados.current = estados
  }, [estados, listo])

  useEffect(() => {
    const map = mapRef.current
    if (!listo || !map) return
    for (const codigo of resaltadasAplicadas.current) {
      if (!resaltadas.has(codigo)) aplicarFeatureState(map, codigo, { resaltada: false })
    }
    for (const codigo of resaltadas) aplicarFeatureState(map, codigo, { resaltada: true })
    resaltadasAplicadas.current = resaltadas
  }, [resaltadas, listo])

  return (
    <div className="mapa">
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
