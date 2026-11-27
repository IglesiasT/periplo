import type * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, LayerSpecification } from 'maplibre-gl'
import type { Tema } from '../../tema'
import type { Epoca } from '../../types'
import { colorRelleno, rellenoHistorico, rotulosComoGeoJSON, SOURCES, visibilidadRotulos } from './estilo'

/** Lo que cambia en un mapa ya cargado: lo usan el mapa de la pantalla y el que rinde la imagen exportada. */

// Los códigos de país, provincia y departamento no se pisan: alcanza con darle el estado a todas las sources.
export function aplicarFeatureState(map: maplibregl.Map, codigo: string, estado: Record<string, unknown>) {
  for (const source of SOURCES) map.setFeatureState({ source, id: codigo }, estado)
}

/** Pinta el mapa como era ese año, o como es hoy si no hay época: los rellenos y los rótulos. */
export function aplicarEpoca(map: maplibregl.Map, epoca: Epoca | undefined, tema: Tema) {
  const relleno = epoca ? rellenoHistorico(epoca, tema) : colorRelleno(tema)
  for (const source of SOURCES) map.setPaintProperty(`${source}-relleno`, 'fill-color', relleno)
  map.getSource<GeoJSONSource>('rotulos-epoca')?.setData(rotulosComoGeoJSON(epoca))
  for (const [capa, visibilidad] of Object.entries(visibilidadRotulos(Boolean(epoca)))) {
    map.setLayoutProperty(capa, 'visibility', visibilidad)
  }
}

type PropiedadPaint = Parameters<maplibregl.Map['setPaintProperty']>[1]
type PropiedadLayout = Parameters<maplibregl.Map['setLayoutProperty']>[1]

// Lleva las capas del mapa a las de otro estilo con las mismas capas (otra lente). MapLibre ignora los
// valores que no cambiaron, así que alcanza con pasarle todo: solo se tocan los zooms y las opacidades.
export function aplicarCapas(map: maplibregl.Map, capas: LayerSpecification[]) {
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
