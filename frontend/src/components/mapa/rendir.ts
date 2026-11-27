import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import type { Resaltadas } from '../../resaltado'
import type { Tema } from '../../tema'
import type { Epoca, EstadosRegiones, Foto } from '../../types'
import { aplicarCapas, aplicarEpoca, aplicarFeatureState } from './aplicar'
import { crearEstilo, type Lente, lenteSinFundido } from './estilo'
import { fotosComoGeoJSON } from './fotos'

/** Dónde mira el mapa exportado: una posición, o un recuadro [oeste, sur, este, norte] que tiene que entrar entero. */
export type Destino =
  | { center: [number, number]; zoom: number; bearing: number }
  | { limites: [number, number, number, number] }

export interface PedidoMapa {
  tema: Tema
  lente: Lente
  estados: EstadosRegiones
  resaltadas: Resaltadas
  epoca: Epoca | undefined
  fotos: Foto[]
  destino: Destino
  /** Tamaño del mapa en la lámina, en px lógicos. */
  ancho: number
  alto: number
  /** Píxeles reales por px lógico. */
  densidad: number
}

const ESPERA_MAXIMA_MS = 20000

/**
 * Rinde el mapa en un MapLibre aparte, fuera de la pantalla y del tamaño exacto de la lámina: no mueve el de la
 * pantalla y puede tener otra proporción. Es descartable, así que puede guardar el buffer de dibujo (en el mapa
 * de la pantalla le costaría rendimiento a cada cuadro).
 */
export function rendirMapa(pedido: PedidoMapa): Promise<HTMLCanvasElement> {
  const { tema, lente, estados, resaltadas, epoca, fotos, destino, ancho, alto, densidad } = pedido
  const contenedor = document.createElement('div')
  Object.assign(contenedor.style, {
    position: 'fixed', left: '-100000px', top: '0', width: `${ancho}px`, height: `${alto}px`, visibility: 'hidden',
  })
  document.body.appendChild(contenedor)

  const map = new maplibregl.Map({
    container: contenedor,
    style: crearEstilo(tema, window.location.href, lente, Boolean(epoca)),
    pixelRatio: densidad,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
    renderWorldCopies: false,
    canvasContextAttributes: { preserveDrawingBuffer: true },
    ...('limites' in destino ? {} : destino),
  })

  const limpiar = () => {
    map.remove()
    contenedor.remove()
  }

  return new Promise<HTMLCanvasElement>((resolver, rechazar) => {
    const reloj = setTimeout(() => {
      limpiar()
      rechazar(new Error('El mapa tardó demasiado en dibujarse.'))
    }, ESPERA_MAXIMA_MS)
    map.on('error', (evento) => console.warn('Mapa de la lámina:', evento.error))

    map.once('load', () => {
      for (const [codigo, estado] of Object.entries(estados)) aplicarFeatureState(map, codigo, { estado })
      for (const [codigo, resaltado] of resaltadas) aplicarFeatureState(map, codigo, { resaltada: resaltado })
      map.getSource<GeoJSONSource>('fotos')?.setData(fotosComoGeoJSON(fotos))
      if ('limites' in destino) {
        const [oeste, sur, este, norte] = destino.limites
        const margen = Math.round(Math.min(ancho, alto) * 0.06)
        map.fitBounds([[oeste, sur], [este, norte]], { padding: margen, animate: false })
      }
      // Con el zoom ya decidido: que la imagen no quede a mitad de un fundido entre dos niveles.
      const fija = lenteSinFundido(lente, map.getZoom(), Boolean(epoca))
      if (fija !== lente) aplicarCapas(map, crearEstilo(tema, window.location.href, fija, Boolean(epoca)).layers)
      // Después de las capas, que vuelven los rellenos a los del presente (igual que en Mapa.tsx).
      aplicarEpoca(map, epoca, tema)
      // `idle`: no queda nada por cargar ni por dibujar, ni siquiera los rótulos.
      map.once('idle', () => {
        clearTimeout(reloj)
        const copia = document.createElement('canvas')
        copia.width = map.getCanvas().width
        copia.height = map.getCanvas().height
        copia.getContext('2d')!.drawImage(map.getCanvas(), 0, 0)
        limpiar()
        resolver(copia)
      })
    })
  })
}
