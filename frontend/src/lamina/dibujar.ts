import { ROSA } from '../components/mapa/rosa'
import type { Tema } from '../tema'
import type { ContenidoLamina } from './contenido'
import type { Layout, Rect } from './layout'

interface Pedido {
  tema: Tema
  layout: Layout
  contenido: ContenidoLamina
  /** El mapa ya rendido, del tamaño de `layout.mapa` por la densidad. */
  mapa: HTMLCanvasElement
  densidad: number
  /** Rumbo del mapa, para que la rosa apunte al norte. */
  rumbo: number
}

const fuente = (tam: number, familia: string, estilo = 'normal') => `${estilo} ${tam}px ${familia}`

/** Las fuentes de la lámina, que el canvas no espera solo: si no están cargadas dibuja con la de reserva. */
export async function cargarFuentes(tema: Tema, layout: Layout) {
  const { titulo, subtitulo, leyenda } = layout.textos
  await Promise.all([
    fuente(titulo.tam, tema.fuentes.titulo),
    fuente(subtitulo.tam, tema.fuentes.cursiva, tema.forma.estiloCursiva),
    fuente(leyenda.tam, tema.fuentes.texto),
  ].map((f) => document.fonts.load(f).catch(() => [])))
}

/** Achica la letra hasta que el texto entre en el ancho. */
function ajustar(ctx: CanvasRenderingContext2D, texto: string, tam: number, familia: string, ancho: number, estilo?: string) {
  let t = tam
  ctx.font = fuente(t, familia, estilo)
  while (t > 8 && ctx.measureText(texto).width > ancho) {
    t -= 1
    ctx.font = fuente(t, familia, estilo)
  }
}

function marcoCartela(ctx: CanvasRenderingContext2D, tema: Tema, { marco, ornamento, mapa, pie }: Layout) {
  ctx.strokeStyle = tema.ui.marco
  ctx.lineWidth = 2.5
  ctx.strokeRect(marco.x, marco.y, marco.ancho, marco.alto)
  ctx.lineWidth = 0.8
  ctx.strokeRect(marco.x + ornamento * 2, marco.y + ornamento * 2, marco.ancho - ornamento * 4, marco.alto - ornamento * 4)
  // El mapa con su filete, separado del pie.
  ctx.strokeStyle = tema.ui.borde
  ctx.lineWidth = 1
  ctx.strokeRect(mapa.x, mapa.y, mapa.ancho, mapa.alto)
  ctx.beginPath()
  ctx.moveTo(pie.x, pie.y + 0.5)
  ctx.lineTo(pie.x + pie.ancho, pie.y + 0.5)
  ctx.stroke()
}

function marcoHud(ctx: CanvasRenderingContext2D, tema: Tema, { marco, ornamento, mapa }: Layout) {
  ctx.strokeStyle = tema.ui.linea
  ctx.lineWidth = 1
  ctx.strokeRect(mapa.x, mapa.y, mapa.ancho, mapa.alto)
  // Esquinas en ángulo, como un visor.
  ctx.strokeStyle = tema.ui.carmin
  ctx.lineWidth = 3
  const { x, y, ancho, alto } = marco
  const l = ornamento
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + ancho, y, -1, 1], [x, y + alto, 1, -1], [x + ancho, y + alto, -1, -1]]) {
    ctx.beginPath()
    ctx.moveTo(cx + dx * l, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + dy * l)
    ctx.stroke()
  }
}

function rosa(ctx: CanvasRenderingContext2D, tema: Tema, { x, y, ancho }: Rect, rumbo: number) {
  const { tinta, papel } = tema.ui
  ctx.save()
  ctx.translate(x + ancho / 2, y + ancho / 2)
  ctx.scale(ancho / ROSA.lado, ancho / ROSA.lado)
  ctx.rotate((-rumbo * Math.PI) / 180)
  ctx.strokeStyle = tinta
  for (const { r, trazo } of ROSA.circulos) {
    ctx.lineWidth = trazo
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, 2 * Math.PI)
    ctx.stroke()
  }
  ctx.fillStyle = tinta
  ctx.fill(new Path2D(ROSA.meridiano))
  const paralelo = new Path2D(ROSA.paralelo)
  ctx.fillStyle = papel
  ctx.fill(paralelo)
  ctx.lineWidth = 0.8
  ctx.stroke(paralelo)
  ctx.fillStyle = tema.estados.visitada
  ctx.fill(new Path2D(ROSA.norte))
  ctx.fillStyle = tinta
  ctx.font = fuente(ROSA.letra.tam, tema.fuentes.titulo)
  ctx.textAlign = 'center'
  ctx.fillText('N', 0, ROSA.letra.y)
  ctx.restore()
}

function pie(ctx: CanvasRenderingContext2D, tema: Tema, { pie, textos }: Layout, contenido: ContenidoLamina) {
  const hud = tema.rasgos.lamina === 'hud'
  const mayusculas = tema.forma.casoTitulo === 'uppercase'
  const titulo = mayusculas ? contenido.titulo.toUpperCase() : contenido.titulo
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = hud ? tema.ui.carminOscuro : tema.ui.tinta
  ajustar(ctx, titulo, textos.titulo.tam, tema.fuentes.titulo, pie.ancho)
  ctx.fillText(titulo, pie.x, textos.titulo.y)

  if (contenido.subtitulo) {
    ctx.fillStyle = hud ? tema.ui.cifra : tema.ui.tenue
    ajustar(ctx, contenido.subtitulo, textos.subtitulo.tam, tema.fuentes.cursiva, pie.ancho, tema.forma.estiloCursiva)
    ctx.fillText(contenido.subtitulo, pie.x, textos.subtitulo.y)
  }

  // La leyenda en una fila: una muestra de color y su nombre. Lo que no entra, no se dibuja.
  const { tam, y } = textos.leyenda
  ctx.font = fuente(tam, tema.fuentes.texto)
  let x = pie.x
  for (const item of contenido.leyenda) {
    const ancho = tam + tam * 0.4 + ctx.measureText(item.etiqueta).width
    if (x + ancho > pie.x + pie.ancho) break
    const muestra = { x: x + 1, y: y - tam * 0.82, lado: tam * 0.85 }
    if (item.contorno) {
      ctx.strokeStyle = item.color
      ctx.lineWidth = 2
      ctx.strokeRect(muestra.x, muestra.y, muestra.lado, muestra.lado)
    } else {
      ctx.fillStyle = item.color
      ctx.fillRect(muestra.x, muestra.y, muestra.lado, muestra.lado)
      ctx.strokeStyle = tema.ui.borde
      ctx.lineWidth = 0.8
      ctx.strokeRect(muestra.x, muestra.y, muestra.lado, muestra.lado)
    }
    ctx.fillStyle = tema.ui.tinta
    ctx.fillText(item.etiqueta, x + tam * 1.4, y)
    x += ancho + tam * 1.2
  }

  // Al pie: la atribución a la izquierda y el nombre del proyecto a la derecha.
  ctx.fillStyle = tema.ui.tenue
  const marca = 'Periplo'
  ctx.font = fuente(textos.atribucion.tam, tema.fuentes.texto)
  const anchoMarca = ctx.measureText(marca).width
  ajustar(ctx, contenido.atribucion, textos.atribucion.tam, tema.fuentes.texto, pie.ancho - anchoMarca - textos.atribucion.tam * 2)
  ctx.fillText(contenido.atribucion, pie.x, textos.atribucion.y)
  ctx.font = fuente(textos.atribucion.tam, tema.fuentes.titulo)
  ctx.textAlign = 'right'
  ctx.fillText(marca, pie.x + pie.ancho, textos.atribucion.y)
}

/** Compone la lámina: el papel, el mapa ya rendido, el marco del tema, la rosa y el pie con los textos. */
export function dibujarLamina({ tema, layout, contenido, mapa, densidad, rumbo }: Pedido): HTMLCanvasElement {
  const lienzo = document.createElement('canvas')
  lienzo.width = layout.lienzo.ancho * densidad
  lienzo.height = layout.lienzo.alto * densidad
  const ctx = lienzo.getContext('2d')!
  ctx.scale(densidad, densidad)

  ctx.fillStyle = tema.ui.papel
  ctx.fillRect(0, 0, layout.lienzo.ancho, layout.lienzo.alto)
  const { x, y, ancho, alto } = layout.mapa
  ctx.drawImage(mapa, x, y, ancho, alto)

  if (tema.rasgos.lamina === 'cartela') marcoCartela(ctx, tema, layout)
  else marcoHud(ctx, tema, layout)
  if (layout.rosa) rosa(ctx, tema, layout.rosa, rumbo)
  pie(ctx, tema, layout, contenido)
  return lienzo
}

export const aPng = (lienzo: HTMLCanvasElement) => new Promise<Blob>((resolver, rechazar) => {
  lienzo.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo armar la imagen.'))), 'image/png')
})
