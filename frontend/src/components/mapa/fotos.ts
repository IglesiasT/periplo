import type { FeatureCollection } from 'geojson'
import { formatearFecha } from '../../etiquetas'
import type { Foto } from '../../types'

/** Las fotos con GPS como puntos, con lo que muestra su popup: la miniatura y "región · fecha". */
export function fotosComoGeoJSON(fotos: Foto[]): FeatureCollection {
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
export function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
