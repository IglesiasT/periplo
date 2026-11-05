import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import type { Point } from 'geojson'
import { ETIQUETAS_ESTADO } from '../../etiquetas'
import { nombreEntidad } from '../../historia'
import type { Epoca, EstadoRegion } from '../../types'
import { CAPAS_FOTOS, capasConsultables, type Lente } from './estilo'
import { htmlPopupFoto, htmlPopupRegion } from './popup'

/** Lo que los handlers del mapa necesitan saber de React en el momento de cada evento. */
export interface EstadoInteracciones {
  lente: Lente
  epoca?: Epoca
  /** Códigos de las regiones con ficha escrita. */
  fichas?: ReadonlySet<string>
  /** Si está, el mapa está en modo de marcar: cada click en una región la manda acá. */
  alClickearRegion?: (codigo: string) => void
  /** Click en una región fuera del modo de marcar (y que no cae en una foto). */
  alElegirRegion?: (codigo: string) => void
}

/**
 * Popup al pasar el mouse y clicks. Los handlers de MapLibre se registran una sola vez al crear el mapa: si
 * recibieran las props directamente verían siempre las de ese momento, así que las piden en cada evento.
 * No hace falta desconectarlos: mueren con el mapa.
 */
export function conectarInteracciones(map: maplibregl.Map, estado: () => EstadoInteracciones) {
  // queryRenderedFeatures devuelve primero la capa de más arriba: el departamento si lo hay.
  const regionEn = (punto: maplibregl.PointLike) =>
    map.queryRenderedFeatures(punto, { layers: capasConsultables(map.getZoom(), estado().lente, Boolean(estado().epoca)) })[0]

  // Nombre de la región al pasar el mouse: país, provincia o departamento según el zoom.
  const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })
  map.on('mousemove', (e) => {
    const feature = regionEn(e.point)
    if (!feature) {
      map.getCanvas().style.cursor = ''
      popup.remove()
      return
    }
    const { epoca, fichas, alClickearRegion } = estado()
    const codigo = String(feature.properties.codigo)
    const visita = feature.state.estado as EstadoRegion | undefined
    const original = epoca?.regiones[codigo]
    map.getCanvas().style.cursor = alClickearRegion ? 'crosshair' : 'pointer'
    popup
      .setLngLat(e.lngLat)
      .setHTML(htmlPopupRegion({
        nombre: String(feature.properties.nombre),
        entidad: epoca && (original ? nombreEntidad(original, epoca) : 'Sin entidad en este mapa'),
        detalle: visita ? ETIQUETAS_ESTADO[visita] : 'Sin visitar',
        marcando: Boolean(alClickearRegion),
        tieneFicha: Boolean(fichas?.has(codigo)),
      }))
      .addTo(map)
  })
  map.getCanvas().addEventListener('mouseleave', () => popup.remove())

  map.on('click', async (e) => {
    const { alClickearRegion, alElegirRegion } = estado()
    if (alClickearRegion) {
      const feature = regionEn(e.point)
      if (feature) alClickearRegion(String(feature.properties.codigo))
      return
    }

    const [foto] = map.queryRenderedFeatures(e.point, { layers: CAPAS_FOTOS })
    if (!foto) {
      const region = regionEn(e.point)
      if (region) alElegirRegion?.(String(region.properties.codigo))
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
      .setHTML(htmlPopupFoto(archivo, miniatura, detalle))
      .addTo(map)
  })
  // Cursor de "mano" sobre las fotos.
  for (const capa of CAPAS_FOTOS) {
    map.on('mouseenter', capa, () => { map.getCanvas().style.cursor = 'pointer' })
  }
}
