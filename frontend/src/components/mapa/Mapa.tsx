import { type ReactNode, useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, LayerSpecification } from 'maplibre-gl'
import type { Point } from 'geojson'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { ETIQUETAS_ESTADO } from '../../etiquetas'
import { nombreEntidad } from '../../historia'
import type { Resaltadas } from '../../resaltado'
import type { Tema } from '../../tema'
import type { Epoca, EstadoRegion, EstadosRegiones, Foto } from '../../types'
import {
  CAPAS_FOTOS, capasConsultables, colorRelleno, crearEstilo, type Lente, rellenoHistorico, rotulosComoGeoJSON, SOURCES,
  visibilidadRotulos,
} from './estilo'
import { escapar, fotosComoGeoJSON } from './fotos'
import Leyenda from './Leyenda'
import RosaDeLosVientos from './RosaDeLosVientos'
import {
  type Encuadre, guardarVistaEnHash, margenEncuadre, VISTA_INICIAL, vistaDesdeHash, ZOOM_MAXIMO_ENCUADRE,
} from './vista'

export type { Lente } from './estilo'
export type { Encuadre } from './vista'

// MapLibre procesa los datos en un Web Worker que carga desde un archivo aparte.
// Con `?url` Vite copia ese archivo tal cual y nos da su URL.
maplibregl.setWorkerUrl(workerUrl)

// Los códigos de país, provincia y departamento no se pisan: alcanza con darle el estado a todas las sources.
function aplicarFeatureState(map: maplibregl.Map, codigo: string, estado: Record<string, unknown>) {
  for (const source of SOURCES) map.setFeatureState({ source, id: codigo }, estado)
}

// Lleva las capas del mapa a las de otro estilo con las mismas capas (otra lente). MapLibre ignora los
// valores que no cambiaron, así que alcanza con pasarle todo: solo se tocan los zooms y las opacidades.
// El mapa sobre el que pueden trabajar los efectos: el actual, y solo después de que terminó de cargar.
function mapaListo(listo: boolean, actual: maplibregl.Map | null, cargado: maplibregl.Map | null) {
  return listo && actual && actual === cargado ? actual : null
}

type PropiedadPaint = Parameters<maplibregl.Map['setPaintProperty']>[1]
type PropiedadLayout = Parameters<maplibregl.Map['setLayoutProperty']>[1]

function aplicarCapas(map: maplibregl.Map, capas: LayerSpecification[]) {
  for (const capa of capas) {
    map.setLayerZoomRange(capa.id, capa.minzoom ?? 0, capa.maxzoom ?? 24)
    for (const [propiedad, valor] of Object.entries(capa.paint ?? {})) {
      map.setPaintProperty(capa.id, propiedad as PropiedadPaint, valor)
    }
    if ('layout' in capa) {
      for (const [propiedad, valor] of Object.entries(capa.layout ?? {})) {
        map.setLayoutProperty(capa.id, propiedad as PropiedadLayout, valor)
      }
    }
    if ('filter' in capa) map.setFilter(capa.id, capa.filter)
  }
}

interface Props {
  /** El estilo se arma con este tema al crear el mapa; otro tema crea otro mapa. */
  tema: Tema
  /** Qué nivel se ve: el que corresponde al zoom (automática) o uno fijo. Cambiarla no recrea el mapa. */
  lente: Lente
  /** Estado de cada región visitada o deseada (de /api/estados/). */
  estados: EstadosRegiones | undefined
  /** Regiones a destacar con un contorno (las del viaje, el logro o la ficha elegidos) y cómo (ver resaltado.ts). */
  resaltadas: Resaltadas
  /** Adónde acercar el mapa. Cada valor nuevo lo mueve una vez, aunque los límites sean los mismos. */
  encuadre?: Encuadre
  /** Si está, el mapa está en modo edición: cada click en una región la manda acá. */
  alClickearRegion?: (codigo: string) => void
  fotos: Foto[] | undefined
  /** Click en una región fuera del modo de marcar (y que no cae en una foto): abre su ficha. */
  alElegirRegion?: (codigo: string) => void
  /** Si está, el mapa se pinta como era ese año: cada región con el color de su entidad. */
  epoca?: Epoca
  /** Controles superpuestos al mapa (el selector de época y su panel). */
  children?: ReactNode
}

export default function Mapa({
  tema, lente, estados, resaltadas, encuadre, alClickearRegion, alElegirRegion, fotos, epoca, children,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  // Los handlers de MapLibre se registran una sola vez al crear el mapa: si usaran la prop directamente,
  // verían siempre la versión de ese momento (un closure viejo). Leen la última desde este ref.
  const alClickearRef = useRef(alClickearRegion)
  const alElegirRegionRef = useRef(alElegirRegion)
  const epocaRef = useRef(epoca)
  const lenteRef = useRef(lente)
  useEffect(() => {
    alClickearRef.current = alClickearRegion
    alElegirRegionRef.current = alElegirRegion
    epocaRef.current = epoca
    lenteRef.current = lente
  })
  // `listo` es estado (no ref) para que los efectos de abajo se vuelvan a correr cuando el mapa termina de cargar.
  const [listo, setListo] = useState(false)
  // El mapa que terminó de cargar. Si el tema cambia, el efecto que crea el mapa arma otro en el mismo
  // ciclo en que corren los demás efectos: hasta su "load", ninguno tiene que tocarlo.
  const cargado = useRef<maplibregl.Map | null>(null)
  // Lo que ya está aplicado en el mapa actual, para calcular la diferencia en cada cambio.
  const estadosAplicados = useRef<EstadosRegiones>({})
  const resaltadasAplicadas = useRef<Resaltadas>(new Map())

  useEffect(() => {
    // Mapa nuevo (StrictMode monta dos veces en desarrollo): todavía no tiene nada pintado.
    estadosAplicados.current = {}
    resaltadasAplicadas.current = new Map()
    const map = new maplibregl.Map({
      container: contenedor.current!,
      style: crearEstilo(tema, window.location.href, lenteRef.current),
      ...(vistaDesdeHash() ?? VISTA_INICIAL),
      renderWorldCopies: false,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }))
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }), 'bottom-right')
    map.on('moveend', () => guardarVistaEnHash(map))
    // Atrás y Adelante también vuelven a la posición que tenía esa entrada del historial.
    const alNavegar = () => map.jumpTo(vistaDesdeHash() ?? VISTA_INICIAL)
    window.addEventListener('popstate', alNavegar)
    map.on('load', () => {
      cargado.current = map
      setListo(true)
    })
    // queryRenderedFeatures devuelve primero la capa de más arriba: el departamento si lo hay.
    const regionEn = (punto: maplibregl.PointLike) =>
      map.queryRenderedFeatures(punto, { layers: capasConsultables(map.getZoom(), lenteRef.current) })[0]

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

      const [foto] = map.queryRenderedFeatures(e.point, { layers: CAPAS_FOTOS })
      if (!foto) {
        const region = regionEn(e.point)
        if (region) alElegirRegionRef.current?.(String(region.properties.codigo))
        return
      }
      const punto = (foto.geometry as Point).coordinates as [number, number]
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
      window.removeEventListener('popstate', alNavegar)
      map.remove()
      mapRef.current = null
      cargado.current = null
      setListo(false)
    }
    // El estilo se arma con el tema: si cambia, se crea otro mapa. (App además usa key={tema.id}.)
  }, [tema])

  // React es declarativo ("el mapa tiene estos estados") y MapLibre imperativo ("pintá esta región"):
  // cada vez que cambian las props se aplica solo la diferencia con lo que ya está pintado.
  useEffect(() => {
    const map = mapaListo(listo, mapRef.current, cargado.current)
    if (!map || !estados) return
    for (const codigo of Object.keys(estadosAplicados.current)) {
      if (!(codigo in estados)) aplicarFeatureState(map, codigo, { estado: null })
    }
    for (const [codigo, estado] of Object.entries(estados)) {
      if (estadosAplicados.current[codigo] !== estado) aplicarFeatureState(map, codigo, { estado })
    }
    estadosAplicados.current = estados
  }, [estados, listo])

  useEffect(() => {
    const map = mapaListo(listo, mapRef.current, cargado.current)
    if (!map) return
    for (const codigo of resaltadasAplicadas.current.keys()) {
      if (!resaltadas.has(codigo)) aplicarFeatureState(map, codigo, { resaltada: null })
    }
    for (const [codigo, resaltado] of resaltadas) {
      if (resaltadasAplicadas.current.get(codigo) !== resaltado) aplicarFeatureState(map, codigo, { resaltada: resaltado })
    }
    resaltadasAplicadas.current = resaltadas
  }, [resaltadas, listo])

  useEffect(() => {
    const map = mapaListo(listo, mapRef.current, cargado.current)
    if (!map || !encuadre) return
    const [oeste, sur, este, norte] = encuadre.limites
    map.fitBounds([[oeste, sur], [este, norte]], {
      padding: margenEncuadre(map), maxZoom: ZOOM_MAXIMO_ENCUADRE, duration: 1200,
    })
  }, [encuadre, listo])

  // Cambiar de lente reescribe las capas del mapa que ya está cargado, sin volver a bajar los GeoJSON.
  useEffect(() => {
    const map = mapaListo(listo, mapRef.current, cargado.current)
    if (!map) return
    aplicarCapas(map, crearEstilo(tema, window.location.href, lente).layers)
  }, [lente, listo, tema])

  // Después de la lente, que devuelve los rellenos y los rótulos a los del presente.
  useEffect(() => {
    const map = mapaListo(listo, mapRef.current, cargado.current)
    if (!map) return
    const relleno = epoca ? rellenoHistorico(epoca, tema) : colorRelleno(tema)
    for (const source of SOURCES) map.setPaintProperty(`${source}-relleno`, 'fill-color', relleno)
    map.getSource<GeoJSONSource>('rotulos-epoca')?.setData(rotulosComoGeoJSON(epoca))
    for (const [capa, visibilidad] of Object.entries(visibilidadRotulos(Boolean(epoca)))) {
      map.setLayoutProperty(capa, 'visibility', visibilidad)
    }
  }, [epoca, lente, listo, tema])

  useEffect(() => {
    const map = mapaListo(listo, mapRef.current, cargado.current)
    if (!map) return
    map.getSource<GeoJSONSource>('fotos')?.setData(fotosComoGeoJSON(fotos ?? []))
  }, [fotos, listo])

  return (
    <div className="mapa">
      <div ref={contenedor} style={{ width: '100%', height: '100%' }} />
      {/* Los GeoJSON pesan varios MB: mientras bajan, el mapa no queda vacío y mudo. */}
      {!listo && <div className="cargando">Grabando las planchas del mapa…</div>}
      {/* En un año histórico, el panel de la época ocupa el lugar de la leyenda. */}
      {!epoca && <Leyenda tema={tema} />}
      <RosaDeLosVientos tema={tema} />
      {children}
    </div>
  )
}
