/**
 * El estilo del mapa: sources, capas y expresiones. Puro (solo tipos de MapLibre), para poder testearlo.
 * No tiene colores propios: todos salen del tema que recibe `crearEstilo`.
 */
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { colorEntidad, nombreEntidad } from '../../historia'
import type { Tema } from '../../tema'
import type { Epoca } from '../../types'

/**
 * Lentes del mapa, como los modos de mapa de Victoria 3. La automática es el zoom semántico: países de
 * lejos, provincias al acercarse y, en Argentina, departamentos más cerca. Las otras fijan un nivel
 * aunque se acerque o se aleje.
 */
export type Lente = 'automatica' | 'paises' | 'provincias' | 'departamentos'

/** Zoom alrededor del cual cada nivel reemplaza al de arriba: países → provincias → departamentos. */
interface Umbrales {
  provincias: number
  departamentos: number
}

// El mapa va del zoom 0 al 24: un umbral fuera de ese rango fija el nivel. `departamentos` tiene que
// quedar más de 2 × FUNDIDO por encima de `provincias`, para que los fundidos no se pisen.
export const UMBRALES: Record<Lente, Umbrales> = {
  automatica: { provincias: 4, departamentos: 7 },
  paises: { provincias: 30, departamentos: 32 },
  provincias: { provincias: -2, departamentos: 30 },
  departamentos: { provincias: -2, departamentos: -0.5 },
}

// En un año histórico la lente automática pasa antes a provincias. A nivel de país, cada país de hoy toma una
// sola entidad: Alemania en 1815 se pintaría entera como Prusia, tapando a Hanover o Baviera.
const AUTOMATICA_EN_EPOCA: Umbrales = { ...UMBRALES.automatica, provincias: 2.5 }

export function umbralesDe(lente: Lente, enEpoca: boolean): Umbrales {
  return lente === 'automatica' && enEpoca ? AUTOMATICA_EN_EPOCA : UMBRALES[lente]
}

const FUNDIDO = 0.5 // medio nivel de zoom hacia cada lado

// Por debajo de este zoom no se rotulan provincias, aunque la lente las muestre: serían miles de nombres.
const ZOOM_MINIMO_ROTULOS_PROVINCIAS = 2

/** minzoom y maxzoom de una capa: MapLibre solo acepta de 0 a 24. */
const acotar = (zoom: number) => Math.min(24, Math.max(0, zoom))

export const SOURCES = ['paises', 'provincias', 'departamentos'] as const
type Source = (typeof SOURCES)[number]

const ESTADO: ExpressionSpecification = ['coalesce', ['feature-state', 'estado'], 'ninguno']

// Feature-state "resaltada": 'directa' (la región elegida) o 'contiene' (su país o provincia); ver resaltado.ts.
const RESALTADA: ExpressionSpecification = ['coalesce', ['feature-state', 'resaltada'], 'ninguna']
const DIRECTA: ExpressionSpecification = ['==', RESALTADA, 'directa']
const ALGUNA: ExpressionSpecification = ['!=', RESALTADA, 'ninguna']

// Provincias con un nivel más detallado debajo (por ahora, solo las argentinas del IGN).
const TIENE_DEPARTAMENTOS: ExpressionSpecification = ['==', ['get', 'padre'], 'ARG']

const ES_DESEO: ExpressionSpecification = ['case', ['==', ESTADO, 'deseo'], 1, 0]

const VISITADA: ExpressionSpecification = ['match', ESTADO, ['estadia', 'paso', 'transito'], true, false]

/** El color de cada región sale de su feature-state "estado"; si no tiene (o es un deseo), queda la tierra. */
export function colorRelleno(tema: Tema): ExpressionSpecification {
  return [
    'match', ESTADO,
    'estadia', tema.estados.estadia,
    'paso', tema.estados.paso,
    'transito', tema.estados.transito,
    tema.mapa.noVisitado,
  ]
}

/** En un año histórico, cada región toma el color de la entidad que la ocupaba: entintado si la visité,
 *  en aguada si no. Un solo match por intensidad, con todas las regiones de cada entidad juntas. */
export function rellenoHistorico(epoca: Epoca, tema: Tema): ExpressionSpecification | string {
  const regionesDe = new Map<string, string[]>()
  for (const [codigo, entidad] of Object.entries(epoca.regiones)) {
    regionesDe.set(entidad, [...(regionesDe.get(entidad) ?? []), codigo])
  }
  if (regionesDe.size === 0) return tema.mapa.noVisitado
  const porEntidad = (intenso: boolean) => [
    'match', ['get', 'codigo'],
    ...[...regionesDe].flatMap(([entidad, codigos]) => [codigos, colorEntidad(entidad, epoca, intenso, tema.aguadas)]),
    tema.mapa.noVisitado,
  ] as unknown as ExpressionSpecification
  return ['case', VISITADA, porEntidad(true), porEntidad(false)]
}

type Valor = number | ExpressionSpecification

// Opacidad que interpola entre paradas [zoom, valor]: así se hace el fundido entre niveles.
function opacidadPorZoom(...paradas: [number, Valor][]): ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], ...paradas.flat()] as unknown as ExpressionSpecification
}

// --- Rótulos ---
// MapLibre dibuja el texto con las mismas fuentes del panel: `font-faces` le pasa los archivos y
// las rasteriza en el navegador, sin un servidor de glyphs. Los nombres de acá son los de `text-font`,
// los mismos para cualquier tema: cada tema dice qué archivo va detrás (tema.fuentes.mapa).
const VERSALITAS = 'Rotulo versalitas'
const CURSIVA = 'Rotulo cursiva'

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

function capasRotulos(tema: Tema, { provincias: p }: Umbrales): LayerSpecification[] {
  // Contorno de papel alrededor de las letras: se leen igual sobre la tinta carmín.
  const halo = { 'text-halo-color': tema.mapa.haloRotulo, 'text-halo-width': 1.6, 'text-halo-blur': 0.5 }
  // Las provincias se rotulan desde que aparecen, pero nunca a un zoom tan lejano que serían miles.
  const inicio = Math.max(p, ZOOM_MINIMO_ROTULOS_PROVINCIAS)
  return [
    {
      id: 'rotulos-oceanos', type: 'symbol', source: 'rotulos', filter: ['==', NIVEL_ROTULO, 'oceano'],
      layout: {
        'text-field': ['get', 'nombre'], 'text-font': [CURSIVA], 'text-max-width': 6, 'text-letter-spacing': 0.25,
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, 13, 5, 22],
      },
      paint: { 'text-color': tema.mapa.rotuloAgua },
    },
    {
      id: 'rotulos-mares', type: 'symbol', source: 'rotulos', filter: ['==', NIVEL_ROTULO, 'mar'], minzoom: 2.5,
      layout: {
        'text-field': ['get', 'nombre'], 'text-font': [CURSIVA], 'text-max-width': 7, 'text-letter-spacing': 0.12,
        'text-size': ['interpolate', ['linear'], ['zoom'], 2.5, 12, 6, 17],
      },
      paint: { 'text-color': tema.mapa.rotuloAgua },
    },
    {
      id: 'rotulos-mares-menores', type: 'symbol', source: 'rotulos', filter: ['==', NIVEL_ROTULO, 'mar-menor'],
      minzoom: 5,
      layout: {
        'text-field': ['get', 'nombre'], 'text-font': [CURSIVA], 'text-max-width': 6, 'text-letter-spacing': 0.1,
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 12, 8, 15],
      },
      paint: { 'text-color': tema.mapa.rotuloAgua },
    },
    {
      id: 'rotulos-provincias', type: 'symbol', source: 'rotulos', minzoom: acotar(inicio),
      filter: ['all', ['==', NIVEL_ROTULO, 'provincia'], visiblesPorArea([inicio, 30000], [inicio + 1, 5000], [inicio + 2, 0])],
      layout: {
        'text-field': ['get', 'nombre'], 'text-font': [VERSALITAS], 'text-max-width': 7,
        'text-letter-spacing': 0.08, 'text-padding': 3, 'symbol-sort-key': ['-', AREA],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, porArea(11, 14), 8, porArea(14, 19)],
      },
      paint: {
        'text-color': tema.mapa.rotuloProvincia, ...halo,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], inicio, 0, inicio + FUNDIDO, 1],
      },
    },
    // Países al final: se ubican primero y, si chocan con una provincia, gana el país. Se apagan cuando
    // aparecen las provincias: en las lentes de provincias y departamentos, no se ven.
    {
      id: 'rotulos-paises', type: 'symbol', source: 'rotulos', maxzoom: acotar(p + 1.5),
      filter: ['all', ['==', NIVEL_ROTULO, 'pais'], visiblesPorArea([0, 250000], [2, 60000], [3, 10000], [4, 0])],
      layout: {
        'text-field': ['get', 'nombre'], 'text-font': [VERSALITAS], 'text-max-width': 7,
        'text-letter-spacing': 0.14, 'text-padding': 4, 'symbol-sort-key': ['-', AREA],
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, porArea(9, 16), 5, porArea(13, 26)],
      },
      paint: {
        'text-color': tema.mapa.rotuloPais, ...halo,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], p + 0.8, 1, p + 1.5, 0],
      },
    },
    // Las entidades del año elegido, en lugar de los países y provincias de hoy (ver visibilidadRotulos).
    // No dependen de la lente: una entidad no es un país ni una provincia de hoy.
    {
      id: 'rotulos-epoca', type: 'symbol', source: 'rotulos-epoca',
      filter: visiblesPorArea([0, 1_500_000], [1, 600_000], [2, 150_000], [3, 40_000], [4, 8_000], [5, 0]),
      layout: {
        visibility: 'none',
        'text-field': ['get', 'nombre'], 'text-font': [VERSALITAS], 'text-max-width': 8,
        'text-letter-spacing': 0.1, 'text-padding': 3, 'symbol-sort-key': ['-', AREA],
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, porArea(9, 15), 5, porArea(12, 22)],
      },
      paint: { 'text-color': tema.mapa.rotuloPais, ...halo },
    },
  ]
}

/** Qué rótulos se ven: con un año elegido, los nombres de hoy (países y provincias) dejan lugar a los
 *  de las entidades de esa época. Los de océanos y mares siguen siempre. */
export function visibilidadRotulos(enEpoca: boolean): Record<string, 'visible' | 'none'> {
  const hoy = enEpoca ? 'none' : 'visible'
  return { 'rotulos-paises': hoy, 'rotulos-provincias': hoy, 'rotulos-epoca': enEpoca ? 'visible' : 'none' }
}

/** Un punto por entidad del año, con su nombre en castellano si está traducido. */
export function rotulosComoGeoJSON(epoca: Epoca | undefined): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (epoca?.rotulos ?? []).map(({ entidad, lon, lat, area_km2 }) => ({
      type: 'Feature',
      properties: { nombre: nombreEntidad(entidad, epoca!), area_km2 },
      geometry: { type: 'Point', coordinates: [lon, lat] },
    })),
  }
}

// Resaltado de una source: un halo de papel debajo y el trazo de tinta encima, para que se lea sobre
// cualquier relleno. `opacidad(f)` arma la expresión con f como opacidad máxima: el zoom solo puede ir
// en el interpolate de más afuera, así que el halo no puede ser la opacidad del trazo multiplicada.
function capasResaltado(source: Source, opacidad: (f: number) => Valor, tema: Tema): LayerSpecification[] {
  return [
    {
      id: `${source}-resaltada-halo`, type: 'line', source, layout: { 'line-join': 'round' },
      paint: { 'line-color': tema.mapa.halo, 'line-width': 6, 'line-blur': 1.5, 'line-opacity': opacidad(0.85) },
    },
    {
      id: `${source}-resaltada`, type: 'line', source, layout: { 'line-join': 'round' },
      paint: { 'line-color': tema.mapa.resaltado, 'line-width': 2, 'line-opacity': opacidad(1) },
    },
  ] as LayerSpecification[]
}

export const CAPAS_FOTOS = ['fotos-grupos', 'fotos-punto']

/** Capas donde buscar la región bajo el mouse, de la más detallada a la menos, según el zoom y la lente. */
export function capasConsultables(zoom: number, lente: Lente, enEpoca = false): string[] {
  const { provincias, departamentos } = umbralesDe(lente, enEpoca)
  if (zoom < provincias) return ['paises-relleno']
  if (zoom < departamentos) return ['provincias-relleno']
  return ['departamentos-relleno', 'provincias-relleno']
}

const ATRIBUCION_NE = '<a href="https://www.naturalearthdata.com/">Natural Earth</a>'
// Requerida por la licencia del IGN: fuente y fecha de los datos originales.
const ATRIBUCION_IGN =
  'FUENTE: <a href="https://www.ign.gob.ar/">Instituto Geográfico Nacional de la República Argentina</a> (límites al 11/11/2019)'

/** Style escrito a mano: sin tiles de terceros, solo fondo + países + provincias + departamentos.
 *  `base` resuelve las URLs relativas de las fuentes (MapLibre las pide desde su Web Worker).
 *  Todas las lentes tienen las mismas capas con las mismas propiedades: solo cambian los valores. */
export function crearEstilo(tema: Tema, base: string, lente: Lente = 'automatica', enEpoca = false): StyleSpecification {
  const umbrales = umbralesDe(lente, enEpoca)
  const { provincias: p, departamentos: d } = umbrales
  const relleno = colorRelleno(tema)
  // Contorno solo para las regiones de la lista de deseos: es todo lo que las marca en el mapa.
  const contornoDeseo = { 'line-color': tema.estados.deseo, 'line-width': 1.2, 'line-opacity': ES_DESEO }
  // Paradas [zoom, opacidad] del relleno de cada nivel.
  const paradasPaises: [number, Valor][] = [[p - FUNDIDO, 1], [p + FUNDIDO, 0]]
  const paradasProvincias: [number, Valor][] = [
    [p - FUNDIDO, 0],
    [p + FUNDIDO, 1],
    [d - FUNDIDO, 1],
    [d + FUNDIDO, ['case', TIENE_DEPARTAMENTOS, 0, 1]],
  ]
  const paradasDepartamentos: [number, Valor][] = [[d - FUNDIDO, 0], [d + FUNDIDO, 1]]
  return {
    version: 8,
    'font-faces': {
      [VERSALITAS]: new URL(tema.fuentes.mapa.versalitas, base).href,
      [CURSIVA]: new URL(tema.fuentes.mapa.cursiva, base).href,
    },
    sources: {
      // Un punto por región (y por océano o mar) donde va su nombre: lo genera `manage.py generar_rotulos`.
      rotulos: { type: 'geojson', data: '/geo/rotulos.geojson' },
      // Los de las entidades del año elegido llegan de la API: arranca vacía y se completa con setData().
      'rotulos-epoca': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      // promoteId: usa la propiedad "codigo" como id de cada feature, para poder darle estado.
      paises: { type: 'geojson', data: '/geo/paises.geojson', promoteId: 'codigo', attribution: ATRIBUCION_NE },
      provincias: { type: 'geojson', data: '/geo/provincias.geojson', promoteId: 'codigo', attribution: ATRIBUCION_NE },
      departamentos: {
        type: 'geojson', data: '/geo/departamentos.geojson', promoteId: 'codigo', attribution: ATRIBUCION_IGN,
      },
      // cluster: MapLibre agrupa las fotos cercanas en un solo círculo (con "point_count") hasta este zoom.
      fotos: {
        type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 40, clusterMaxZoom: 14,
      },
    },
    layers: [
      { id: 'fondo', type: 'background', paint: { 'background-color': tema.mapa.mar } },

      // Provincias: aparecen al acercarse; las argentinas se vuelven a desvanecer cuando llegan los departamentos.
      {
        id: 'provincias-relleno', type: 'fill', source: 'provincias',
        minzoom: acotar(p - FUNDIDO),
        paint: { 'fill-color': relleno, 'fill-opacity': opacidadPorZoom(...paradasProvincias) },
      },

      // Departamentos (solo Argentina): aparecen al acercarse más.
      {
        id: 'departamentos-relleno', type: 'fill', source: 'departamentos',
        minzoom: acotar(d - FUNDIDO),
        paint: { 'fill-color': relleno, 'fill-opacity': opacidadPorZoom(...paradasDepartamentos) },
      },
      {
        id: 'departamentos-frontera', type: 'line', source: 'departamentos',
        minzoom: acotar(d - FUNDIDO),
        paint: { 'line-color': tema.mapa.fronteraProvincia, 'line-width': 0.75 },
      },
      {
        id: 'departamentos-deseo', type: 'line', source: 'departamentos',
        minzoom: acotar(d - FUNDIDO),
        paint: contornoDeseo,
      },

      {
        id: 'provincias-frontera', type: 'line', source: 'provincias',
        minzoom: acotar(p - FUNDIDO),
        paint: {
          'line-color': tema.mapa.fronteraProvincia,
          'line-width': 0.75,
          // Las fronteras de Natural Earth no coinciden exacto con las del IGN: con departamentos se ocultan.
          'line-opacity': [
            'interpolate', ['linear'], ['zoom'],
            d - FUNDIDO, 1,
            d + FUNDIDO, ['case', TIENE_DEPARTAMENTOS, 0, 1],
          ],
        },
      },
      {
        id: 'provincias-deseo', type: 'line', source: 'provincias',
        minzoom: acotar(p - FUNDIDO),
        paint: contornoDeseo,
      },

      // Países: se ven de lejos y se desvanecen al acercarse. La frontera queda siempre visible.
      {
        id: 'paises-relleno', type: 'fill', source: 'paises',
        maxzoom: acotar(p + FUNDIDO),
        paint: { 'fill-color': relleno, 'fill-opacity': opacidadPorZoom(...paradasPaises) },
      },
      // Sin maxzoom: un país deseado entero (Japón) mantiene su contorno aunque se vean las provincias.
      { id: 'paises-deseo', type: 'line', source: 'paises', paint: contornoDeseo },
      {
        id: 'paises-frontera', type: 'line', source: 'paises',
        paint: {
          'line-color': tema.mapa.fronteraPais,
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 6, 2],
        },
      },

      // Nombres arriba de los rellenos y las fronteras; las fotos y los resaltados van encima.
      ...capasRotulos(tema, umbrales),

      // Fotos: grupos (más grandes cuantas más fotos) y fotos sueltas.
      {
        id: 'fotos-grupos', type: 'circle', source: 'fotos', filter: ['has', 'point_count'],
        paint: {
          'circle-color': tema.mapa.foto,
          'circle-radius': ['step', ['get', 'point_count'], 8, 5, 11, 20, 15],
          'circle-stroke-color': tema.mapa.halo,
          'circle-stroke-width': 2,
        },
      },
      {
        id: 'fotos-punto', type: 'circle', source: 'fotos', filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': tema.mapa.foto, 'circle-radius': 5, 'circle-stroke-color': tema.mapa.halo,
          'circle-stroke-width': 1.5,
        },
      },

      // Contorno de lo elegido en el panel (feature-state "resaltada"): las directas en cualquier zoom,
      // las que contienen a una elegida solo mientras se ven a ese nivel. Sin minzoom ni maxzoom a propósito.
      ...capasResaltado('departamentos', (f) => ['case', DIRECTA, f, 0], tema),
      ...capasResaltado('provincias', (f) => [
        'interpolate', ['linear'], ['zoom'],
        p - FUNDIDO, ['case', DIRECTA, f, 0],
        p + FUNDIDO, ['case', ALGUNA, f, 0],
        d - FUNDIDO, ['case', ALGUNA, f, 0],
        // Con departamentos, la provincia que los contiene deja el contorno a ellos.
        d + FUNDIDO, ['case', DIRECTA, f, ALGUNA, ['case', TIENE_DEPARTAMENTOS, 0, f], 0],
      ], tema),
      ...capasResaltado('paises', (f) => [
        'interpolate', ['linear'], ['zoom'],
        p - FUNDIDO, ['case', ALGUNA, f, 0],
        p + FUNDIDO, ['case', DIRECTA, f, 0],
      ], tema),
    ],
  }
}
