import { escapar } from './fotos'

interface PopupRegion {
  nombre: string
  /** La entidad de la época que se está mirando; undefined en el presente. */
  entidad?: string
  /** Cómo se la visitó: "Estadía", "Sin visitar"… */
  detalle: string
  /** En modo de marcar, el click marca en lugar de abrir la ficha. */
  marcando: boolean
  tieneFicha: boolean
}

/** Lo que muestra el popup al pasar por una región. Se escapa todo: los nombres vienen de datos de terceros. */
export function htmlPopupRegion({ nombre, entidad, detalle, marcando, tieneFicha }: PopupRegion): string {
  const accion = marcando ? 'Click para marcar' : tieneFicha ? '✎ Tiene ficha: click para leerla' : 'Click para abrir su ficha'
  return [
    `<strong>${escapar(nombre)}</strong>`,
    ...(entidad === undefined ? [] : [`<em>${escapar(entidad)}</em>`]),
    escapar(detalle),
    `<em>${accion}</em>`,
  ].join('<br>')
}

export function htmlPopupFoto(archivo: string, miniatura: string, detalle: string): string {
  return `<div class="popup-foto"><a href="${escapar(archivo)}" target="_blank" rel="noreferrer">`
    + `<img src="${escapar(miniatura)}" alt=""></a>${escapar(detalle)}</div>`
}
