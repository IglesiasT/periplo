import { type ReactNode, useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { ExpressionSpecification, GeoJSONSource, LayerSpecification, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import fuenteVersalitas from '@fontsource/im-fell-english-sc/files/im-fell-english-sc-latin-400-normal.woff2?url'
import fuenteCursiva from '@fontsource/im-fell-english/files/im-fell-english-latin-400-italic.woff2?url'
import { TerraDraw, TerraDrawLineStringMode } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import { formatearFecha } from '../etiquetas'
import { colorEntidad, nombreEntidad } from '../historia'
import type { Epoca, EstadoRegion, EstadosRegiones, Foto, Ruta } from '../types'

// MapLibre procesa los datos en un Web Worker que carga desde un archivo aparte.
// Con `?url` Vite copia ese archivo tal cual y nos da su URL.
maplibregl.setWorkerUrl(workerUrl)

// Los mismos tonos que los tokens de index.css: papel, tinta de grabador y aguada para el mar.
const COLORES = {
  mar: '#c6d4cc',
  noVisitado: '#eee4ce',
  fronteraPais: '#7c6a50',
  fronteraProvincia: '#bfae8c',
  resaltado: '#2b2117',
  ruta: '#5e4e3a',
  rutaResaltada: '#2b2117',
  foto: '#2b2117',
  papel: '#f3ebda',
  rotuloPais: '#4f4232',
  rotuloProvincia: '#3b2f22',
  rotuloAgua: '#4d6b63',
} as const

// De más a menos tinta, como un atlas coloreado a mano. El deseo no se rellena: se raya en índigo.
const COLORES_ESTADO: Record<EstadoRegion, string> = {
  estadia: '#a8382c',
  paso: '#cf7356',
  transito: '#e7a98a',
  deseo: '#3e5c76',
}

const ETIQUETAS_ESTADO: Record<EstadoRegion, string> = {
  estadia: 'Estadía',
  paso: 'De paso',
  transito: 'Tránsito',
  deseo: 'Por conocer',
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

// El color de cada región sale de su feature-state "estado"; si no tiene (o es un deseo), queda el papel.
const COLOR_RELLENO: ExpressionSpecification = [
  'match', ESTADO,
  'estadia', COLORES_ESTADO.estadia,
  'paso', COLORES_ESTADO.paso,
  'transito', COLORES_ESTADO.transito,
  COLORES.noVisitado,
]

const ES_DESEO: ExpressionSpecification = ['case', ['==', ESTADO, 'deseo'], 1, 0]

const VISITADA: ExpressionSpecification = ['match', ESTADO, ['estadia', 'paso', 'transito'], true, false]

// En un año histórico, cada región toma el color de la entidad que la ocupaba: entintado si la
// visité, en aguada si no. Un solo match por intensidad, con todas las regiones de cada entidad juntas.
function rellenoHistorico(epoca: Epoca): ExpressionSpecification | string {
  const regionesDe = new Map<string, string[]>()
  for (const [codigo, entidad] of Object.entries(epoca.regiones)) {
    regionesDe.set(entidad, [...(regionesDe.get(entidad) ?? []), codigo])
  }
  if (regionesDe.size === 0) return COLORES.noVisitado
  const porEntidad = (intenso: boolean) => [
    'match', ['get', 'codigo'],
    ...[...regionesDe].flatMap(([entidad, codigos]) => [codigos, colorEntidad(entidad, epoca, intenso)]),
    COLORES.noVisitado,
  ] as unknown as ExpressionSpecification
  return ['case', VISITADA, porEntidad(true), porEntidad(false)]
}

type Valor = number | ExpressionSpecification

// Opacidad que interpola entre paradas [zoom, valor]: así se hace el fundido entre niveles.
// `factor` la multiplica por feature (el rayado solo se ve en los deseos).
function opacidadPorZoom(factor: Valor, ...paradas: [number, Valor][]): ExpressionSpecification {
  const valores = paradas.flatMap(([zoom, valor]) => [zoom, ['*', valor, factor]])
  return ['interpolate', ['linear'], ['zoom'], ...valores] as unknown as ExpressionSpecification
}

// Contorno solo para las regiones de la lista de deseos.
const CONTORNO_DESEO = {
  'line-color': COLORES_ESTADO.deseo,
  'line-width': 1.2,
  'line-opacity': ES_DESEO,
}

// Rayado diagonal en índigo sobre fondo transparente (debajo queda el papel). Con pixelRatio 2,
// una línea de 1,5 px cada 6 px de pantalla, igual que el --rayado de index.css.
const RAYADO = 'rayado'
function imagenRayado() {
  const lado = 12
  const data = new Uint8Array(lado * lado * 4)
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      if ((x + y) % lado < 3) data.set([0x3e, 0x5c, 0x76, 255], (y * lado + x) * 4)
    }
  }
  return { width: lado, height: lado, data }
}

// Paradas [zoom, opacidad] de cada nivel: el relleno y el rayado de un mismo nivel se funden juntos.
const PARADAS_PAISES: [number, Valor][] = [[ZOOM_PROVINCIAS - FUNDIDO, 1], [ZOOM_PROVINCIAS + FUNDIDO, 0]]
const PARADAS_PROVINCIAS: [number, Valor][] = [
  [ZOOM_PROVINCIAS - FUNDIDO, 0],
  [ZOOM_PROVINCIAS + FUNDIDO, 1],
  [ZOOM_DEPARTAMENTOS - FUNDIDO, 1],
  [ZOOM_DEPARTAMENTOS + FUNDIDO, ['case', TIENE_DEPARTAMENTOS, 0, 1]],
]
const PARADAS_DEPARTAMENTOS: [number, Valor][] = [[ZOOM_DEPARTAMENTOS - FUNDIDO, 0], [ZOOM_DEPARTAMENTOS + FUNDIDO, 1]]

// --- Rótulos ---
// MapLibre dibuja el texto con las mismas fuentes del panel: `font-faces` le pasa los archivos y
// las rasteriza en el navegador, sin un servidor de glyphs. Los nombres de acá son los de `text-font`.
const VERSALITAS = 'Fell Versalitas'
const CURSIVA = 'Fell Cursiva'
const absoluta = (url: string) => new URL(url, window.location.href).href

const NIVEL_ROTULO = ['get', 'nivel'] as ExpressionSpecification
const AREA = ['get', 'area_km2'] as ExpressionSpecification

// Tamaño según la superficie: Rusia grande, Uruguay chico. Raíz cuadrada para que no se dispare.
const porArea = (chico: number, grande: number): ExpressionSpecification =>
  ['interpolate', ['linear'], ['sqrt', AREA], 100, chico, 2000, grande]

// Con poco zoom solo se rotulan las regiones grandes; al acercarse entran las chicas.
// (El zoom en un filtro solo se puede usar como entrada de un step de primer nivel.)
const visiblesPorArea = (...umbrales: [number, number][]): ExpressionSpecification =>
  ['step', ['zoom'], false, ...umbrales.flatMap(([zoom, area]) => [zoom, ['>=', AREA, area]])] as
    unknown as ExpressionSpecification

// Contorno de papel alrededor de las letras: se leen igual sobre la tinta carmín.
const HALO = { 'text-halo-color': 'rgba(243, 235, 218, 0.85)', 'text-halo-width': 1.6, 'text-halo-blur': 0.5 }

const ROTULOS: LayerSpecification[] = [
  {
    id: 'rotulos-oceanos', type: 'symbol', source: 'rotulos', filter: ['==', NIVEL_ROTULO, 'oceano'],
    layout: {
      'text-field': ['get', 'nombre'], 'text-font': [CURSIVA], 'text-max-width': 6, 'text-letter-spacing': 0.25,
      'text-size': ['interpolate', ['linear'], ['zoom'], 1, 13, 5, 22],
    },
    paint: { 'text-color': COLORES.rotuloAgua },
  },
  {
    id: 'rotulos-mares', type: 'symbol', source: 'rotulos', filter: ['==', NIVEL_ROTULO, 'mar'], minzoom: 2.5,
    layout: {
      'text-field': ['get', 'nombre'], 'text-font': [CURSIVA], 'text-max-width': 7, 'text-letter-spacing': 0.12,
      'text-size': ['interpolate', ['linear'], ['zoom'], 2.5, 12, 6, 17],
    },
    paint: { 'text-color': COLORES.rotuloAgua },
  },
  {
    id: 'rotulos-mares-menores', type: 'symbol', source: 'rotulos', filter: ['==', NIVEL_ROTULO, 'mar-menor'],
    minzoom: 5,
    layout: {
      'text-field': ['get', 'nombre'], 'text-font': [CURSIVA], 'text-max-width': 6, 'text-letter-spacing': 0.1,
      'text-size': ['interpolate', ['linear'], ['zoom'], 5, 12, 8, 15],
    },
    paint: { 'text-color': COLORES.rotuloAgua },
  },
  {
    id: 'rotulos-provincias', type: 'symbol', source: 'rotulos', minzoom: ZOOM_PROVINCIAS,
    filter: ['all', ['==', NIVEL_ROTULO, 'provincia'], visiblesPorArea([4, 30000], [5, 5000], [6, 0])],
    layout: {
      'text-field': ['get', 'nombre'], 'text-font': [VERSALITAS], 'text-max-width': 7,
      'text-letter-spacing': 0.08, 'text-padding': 3, 'symbol-sort-key': ['-', AREA],
      'text-size': ['interpolate', ['linear'], ['zoom'], 4, porArea(11, 14), 8, porArea(14, 19)],
    },
    paint: {
      'text-color': COLORES.rotuloProvincia, ...HALO,
      'text-opacity': ['interpolate', ['linear'], ['zoom'], ZOOM_PROVINCIAS, 0, ZOOM_PROVINCIAS + FUNDIDO, 1],
    },
  },
  // Países al final: se ubican primero y, si chocan con una provincia, gana el país.
  {
    id: 'rotulos-paises', type: 'symbol', source: 'rotulos', maxzoom: ZOOM_PROVINCIAS + 1.5,
    filter: ['all', ['==', NIVEL_ROTULO, 'pais'], visiblesPorArea([0, 250000], [2, 60000], [3, 10000], [4, 0])],
    layout: {
      'text-field': ['get', 'nombre'], 'text-font': [VERSALITAS], 'text-max-width': 7,
      'text-letter-spacing': 0.14, 'text-padding': 4, 'symbol-sort-key': ['-', AREA],
      'text-size': ['interpolate', ['linear'], ['zoom'], 1, porArea(9, 16), 5, porArea(13, 26)],
    },
    paint: {
      'text-color': COLORES.rotuloPais, ...HALO,
      'text-opacity': ['interpolate', ['linear'], ['zoom'], ZOOM_PROVINCIAS + 0.8, 1, ZOOM_PROVINCIAS + 1.5, 0],
    },
  },
]

const ATRIBUCION_NE = '<a href="https://www.naturalearthdata.com/">Natural Earth</a>'
// Requerida por la licencia del IGN: fuente y fecha de los datos originales.
const ATRIBUCION_IGN =
  'FUENTE: <a href="https://www.ign.gob.ar/">Instituto Geográfico Nacional de la República Argentina</a> (límites al 11/11/2019)'

// Style escrito a mano: sin tiles de terceros, solo fondo + países + provincias + departamentos.
const STYLE: StyleSpecification = {
  version: 8,
  'font-faces': {
    [VERSALITAS]: absoluta(fuenteVersalitas),
    [CURSIVA]: absoluta(fuenteCursiva),
  },
  sources: {
    // Un punto por región (y por océano o mar) donde va su nombre: lo genera `manage.py generar_rotulos`.
    rotulos: { type: 'geojson', data: '/geo/rotulos.geojson' },
    // promoteId: usa la propiedad "codigo" como id de cada feature, para poder darle estado.
    paises: { type: 'geojson', data: '/geo/paises.geojson', promoteId: 'codigo', attribution: ATRIBUCION_NE },
    provincias: { type: 'geojson', data: '/geo/provincias.geojson', promoteId: 'codigo', attribution: ATRIBUCION_NE },
    departamentos: {
      type: 'geojson', data: '/geo/departamentos.geojson', promoteId: 'codigo', attribution: ATRIBUCION_IGN,
    },
    // Las rutas llegan de la API: arranca vacía y se completa con setData().
    rutas: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    // cluster: MapLibre agrupa las fotos cercanas en un solo círculo (con "point_count") hasta este zoom.
    fotos: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 40, clusterMaxZoom: 14 },
  },
  layers: [
    { id: 'fondo', type: 'background', paint: { 'background-color': COLORES.mar } },

    // Provincias: aparecen al acercarse; las argentinas se vuelven a desvanecer cuando llegan los departamentos.
    {
      id: 'provincias-relleno', type: 'fill', source: 'provincias',
      minzoom: ZOOM_PROVINCIAS - FUNDIDO,
      paint: { 'fill-color': COLOR_RELLENO, 'fill-opacity': opacidadPorZoom(1, ...PARADAS_PROVINCIAS) },
    },
    {
      id: 'provincias-rayado', type: 'fill', source: 'provincias',
      minzoom: ZOOM_PROVINCIAS - FUNDIDO,
      paint: { 'fill-pattern': RAYADO, 'fill-opacity': opacidadPorZoom(ES_DESEO, ...PARADAS_PROVINCIAS) },
    },

    // Departamentos (solo Argentina): aparecen al acercarse más.
    {
      id: 'departamentos-relleno', type: 'fill', source: 'departamentos',
      minzoom: ZOOM_DEPARTAMENTOS - FUNDIDO,
      paint: { 'fill-color': COLOR_RELLENO, 'fill-opacity': opacidadPorZoom(1, ...PARADAS_DEPARTAMENTOS) },
    },
    {
      id: 'departamentos-rayado', type: 'fill', source: 'departamentos',
      minzoom: ZOOM_DEPARTAMENTOS - FUNDIDO,
      paint: { 'fill-pattern': RAYADO, 'fill-opacity': opacidadPorZoom(ES_DESEO, ...PARADAS_DEPARTAMENTOS) },
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
      paint: { 'fill-color': COLOR_RELLENO, 'fill-opacity': opacidadPorZoom(1, ...PARADAS_PAISES) },
    },
    {
      id: 'paises-rayado', type: 'fill', source: 'paises',
      maxzoom: ZOOM_PROVINCIAS + FUNDIDO,
      paint: { 'fill-pattern': RAYADO, 'fill-opacity': opacidadPorZoom(ES_DESEO, ...PARADAS_PAISES) },
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

    // Nombres arriba de los rellenos y las fronteras; las rutas, las fotos y los resaltados van encima.
    ...ROTULOS,

    // Rutas: trazo de tinta discontinuo, como un itinerario dibujado a mano.
    // Las del viaje elegido (propiedad "resaltada" del feature), más gruesas y oscuras.
    {
      id: 'rutas', type: 'line', source: 'rutas',
      layout: { 'line-join': 'round' },
      paint: {
        'line-dasharray': [3, 2],
        'line-color': ['case', ['get', 'resaltada'], COLORES.rutaResaltada, COLORES.ruta],
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          2, ['case', ['get', 'resaltada'], 2, 1],
          8, ['case', ['get', 'resaltada'], 4.5, 2.5],
        ],
      },
    },

    // Fotos: grupos (más grandes cuantas más fotos) y fotos sueltas.
    {
      id: 'fotos-grupos', type: 'circle', source: 'fotos', filter: ['has', 'point_count'],
      paint: {
        'circle-color': COLORES.foto,
        'circle-radius': ['step', ['get', 'point_count'], 8, 5, 11, 20, 15],
        'circle-stroke-color': COLORES.papel,
        'circle-stroke-width': 2,
      },
    },
    {
      id: 'fotos-punto', type: 'circle', source: 'fotos', filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': COLORES.foto, 'circle-radius': 5, 'circle-stroke-color': COLORES.papel, 'circle-stroke-width': 1.5,
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
  /** Si está, el mapa está en modo edición: cada click en una región la manda acá. */
  alClickearRegion?: (codigo: string) => void
  rutas: Ruta[] | undefined
  /** Viaje cuyas rutas se dibujan destacadas. */
  viajeResaltado: number | null
  /** Si está, el mapa está en modo dibujo: al terminar una línea (Enter o click en el último punto) la manda acá. */
  alTerminarDibujo?: (coordenadas: [number, number][]) => void
  fotos: Foto[] | undefined
  /** Si está, el mapa se pinta como era ese año: cada región con el color de su entidad. */
  epoca?: Epoca
  /** Controles superpuestos al mapa (el selector de época y su panel). */
  children?: ReactNode
}

const CAPAS_FOTOS = ['fotos-grupos', 'fotos-punto']

function fotosComoGeoJSON(fotos: Foto[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fotos
      .filter((foto) => foto.lat !== null && foto.lon !== null)
      .map((foto) => ({
        type: 'Feature',
        properties: {
          archivo: foto.archivo,
          miniatura: foto.miniatura ?? foto.archivo,
          detalle: [foto.region_nombre, formatearFecha(foto.tomada_en?.slice(0, 10) ?? null)].filter(Boolean).join(' · '),
        },
        geometry: { type: 'Point', coordinates: [foto.lon!, foto.lat!] },
      })),
  }
}

/** Para meter texto en el HTML de un popup sin que se interprete como HTML. */
function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function rutasComoGeoJSON(rutas: Ruta[], viajeResaltado: number | null): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: rutas.map((ruta) => ({
      type: 'Feature',
      properties: { nombre: ruta.nombre, resaltada: ruta.viaje === viajeResaltado },
      geometry: { type: 'LineString', coordinates: ruta.coordenadas },
    })),
  }
}

export default function Mapa({
  estados, resaltadas, alClickearRegion, rutas, viajeResaltado, alTerminarDibujo, fotos, epoca, children,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  // Los handlers de MapLibre se registran una sola vez al crear el mapa: si usaran la prop directamente,
  // verían siempre la versión de ese momento (un closure viejo). Leen la última desde este ref.
  const alClickearRef = useRef(alClickearRegion)
  const alTerminarDibujoRef = useRef(alTerminarDibujo)
  const epocaRef = useRef(epoca)
  useEffect(() => {
    alClickearRef.current = alClickearRegion
    alTerminarDibujoRef.current = alTerminarDibujo
    epocaRef.current = epoca
  })
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
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }), 'bottom-right')
    // El style pide la imagen del rayado antes de que exista: se genera la primera vez que falta.
    map.on('styleimagemissing', (e) => {
      if (e.id === RAYADO && !map.hasImage(RAYADO)) map.addImage(RAYADO, imagenRayado(), { pixelRatio: 2 })
    })
    map.on('moveend', () => guardarVistaEnHash(map))
    map.on('load', () => setListo(true))
    // queryRenderedFeatures devuelve primero la capa de más arriba: el departamento si lo hay.
    const regionEn = (punto: maplibregl.PointLike) =>
      map.queryRenderedFeatures(punto, { layers: capasConsultables(map.getZoom()) })[0]

    // Nombre de la región al pasar el mouse: país, provincia o departamento según el zoom.
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })
    map.on('mousemove', (e) => {
      const feature = regionEn(e.point)
      const editando = Boolean(alClickearRef.current)
      if (!feature) {
        map.getCanvas().style.cursor = ''
        popup.remove()
        return
      }
      const estado = feature.state.estado as EstadoRegion | undefined
      const detalle = estado ? ETIQUETAS_ESTADO[estado] : 'Sin visitar'
      const epocaActual = epocaRef.current
      const original = epocaActual?.regiones[feature.properties.codigo]
      const entidad = epocaActual
        ? `<em>${escapar(original ? nombreEntidad(original, epocaActual) : 'Sin entidad en este mapa')}</em><br>`
        : ''
      map.getCanvas().style.cursor = editando ? 'crosshair' : 'pointer'
      popup
        .setLngLat(e.lngLat)
        .setHTML(`<strong>${feature.properties.nombre}</strong><br>${entidad}${detalle}`
          + `${editando ? '<br><em>Click para marcar</em>' : ''}`)
        .addTo(map)
    })
    map.getCanvas().addEventListener('mouseleave', () => popup.remove())

    map.on('click', async (e) => {
      if (alClickearRef.current) {
        const feature = regionEn(e.point)
        if (feature) alClickearRef.current(String(feature.properties.codigo))
        return
      }
      if (alTerminarDibujoRef.current) return // los clicks son de terra-draw

      const [foto] = map.queryRenderedFeatures(e.point, { layers: CAPAS_FOTOS })
      if (!foto) return
      const punto = (foto.geometry as GeoJSON.Point).coordinates as [number, number]
      if (foto.properties.cluster_id !== undefined) {
        // Un grupo: acercar hasta el zoom en el que se separa.
        const zoom = await map.getSource<GeoJSONSource>('fotos')!.getClusterExpansionZoom(foto.properties.cluster_id)
        map.easeTo({ center: punto, zoom })
        return
      }
      const { archivo, miniatura, detalle } = foto.properties as Record<string, string>
      new maplibregl.Popup({ offset: 8, maxWidth: '240px' })
        .setLngLat(punto)
        .setHTML(`<div class="popup-foto"><a href="${escapar(archivo)}" target="_blank" rel="noreferrer">`
          + `<img src="${escapar(miniatura)}" alt=""></a>${escapar(detalle)}</div>`)
        .addTo(map)
    })
    // Cursor de "mano" sobre las fotos.
    for (const capa of CAPAS_FOTOS) {
      map.on('mouseenter', capa, () => { map.getCanvas().style.cursor = 'pointer' })
    }

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

  useEffect(() => {
    const map = mapRef.current
    if (!listo || !map) return
    const relleno = epoca ? rellenoHistorico(epoca) : COLOR_RELLENO
    for (const source of SOURCES) map.setPaintProperty(`${source}-relleno`, 'fill-color', relleno)
  }, [epoca, listo])

  useEffect(() => {
    const map = mapRef.current
    if (!listo || !map) return
    map.getSource<GeoJSONSource>('rutas')?.setData(rutasComoGeoJSON(rutas ?? [], viajeResaltado))
  }, [rutas, viajeResaltado, listo])

  useEffect(() => {
    const map = mapRef.current
    if (!listo || !map) return
    map.getSource<GeoJSONSource>('fotos')?.setData(fotosComoGeoJSON(fotos ?? []))
  }, [fotos, listo])

  // Modo dibujo con terra-draw: se crea al entrar al modo y se destruye al salir.
  const dibujando = Boolean(alTerminarDibujo)
  useEffect(() => {
    const map = mapRef.current
    if (!listo || !map || !dibujando) return
    const dibujo = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [new TerraDrawLineStringMode({ styles: { lineStringColor: COLORES.rutaResaltada, lineStringWidth: 3 } })],
    })
    dibujo.start()
    dibujo.setMode('linestring')
    dibujo.on('finish', (id) => {
      const trazo = dibujo.getSnapshotFeature(id)
      if (trazo?.geometry.type === 'LineString') {
        alTerminarDibujoRef.current?.(trazo.geometry.coordinates as [number, number][])
      }
      dibujo.clear()
    })
    return () => dibujo.stop()
  }, [dibujando, listo])

  return (
    <div className="mapa">
      <div ref={contenedor} style={{ width: '100%', height: '100%' }} />
      {/* Los GeoJSON pesan varios MB: mientras bajan, el mapa no queda vacío y mudo. */}
      {!listo && <div className="cargando">Grabando las planchas del mapa…</div>}
      {/* En un año histórico, el panel de la época ocupa el lugar de la leyenda. */}
      {!epoca && <Leyenda />}
      <RosaDeLosVientos />
      {children}
    </div>
  )
}

function Leyenda() {
  const items = [
    ...(Object.keys(COLORES_ESTADO) as EstadoRegion[]).map((estado) => ({
      etiqueta: ETIQUETAS_ESTADO[estado], color: COLORES_ESTADO[estado], clase: estado === 'deseo' ? 'deseo' : '',
    })),
    { etiqueta: 'Sin visitar', color: COLORES.noVisitado, clase: '' },
  ]
  return (
    <div className="leyenda">
      <p className="leyenda-titulo">Leyenda</p>
      {items.map(({ etiqueta, color, clase }) => (
        <div key={etiqueta}>
          <span className={`leyenda-color ${clase}`} style={{ background: color }} />
          {etiqueta}
        </div>
      ))}
    </div>
  )
}

/** Adorno de atlas: siempre apunta al norte porque el mapa no rota. */
function RosaDeLosVientos() {
  return (
    <svg className="rosa" width="70" height="78" viewBox="-35 -43 70 78" aria-hidden="true">
      <circle r="28" fill="none" stroke={COLORES.resaltado} strokeWidth="0.8" />
      <circle r="24" fill="none" stroke={COLORES.resaltado} strokeWidth="0.5" />
      <path d="M0 -32L4.5 0L0 32L-4.5 0Z" fill={COLORES.resaltado} />
      <path d="M-32 0L0 -4.5L32 0L0 4.5Z" fill={COLORES.papel} stroke={COLORES.resaltado} strokeWidth="0.8" />
      <path d="M0 -32L4.5 0L0 0Z" fill={COLORES_ESTADO.estadia} />
      <text y="-35" textAnchor="middle" fontFamily="'IM Fell English SC', serif" fontSize="11"
            fill={COLORES.resaltado}>N</text>
    </svg>
  )
}
