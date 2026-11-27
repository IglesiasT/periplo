import { escapar } from './fotos'

interface PopupRegion {
  nombre: string
  /** URL de la bandera de su país (ver banderas.ts); null si no tiene. */
  bandera?: string | null
  /** La entidad de la época que se está mirando; undefined en el presente. */
  entidad?: string
  /** Cómo se la visitó: "Visitada", "Sin visitar"… */
  detalle: string
  /** En modo de marcar, el click marca en lugar de abrir la ficha. */
  marcando: boolean
  tieneFicha: boolean
}

/** Lo que muestra el popup al pasar por una región. Se escapa todo: los nombres vienen de datos de terceros. */
export function htmlPopupRegion({ nombre, bandera, entidad, detalle, marcando, tieneFicha }: PopupRegion): string {
  const accion = marcando ? 'Click para marcar' : tieneFicha ? '✎ Tiene ficha: click para leerla' : 'Click para abrir su ficha'
  return [
    `<strong class="con-bandera">${bandera ? `<img class="bandera" src="${escapar(bandera)}" alt="">` : ''}`
      + `${escapar(nombre)}</strong>`,
    ...(entidad === undefined ? [] : [`<em>${escapar(entidad)}</em>`]),
    escapar(detalle),
    `<em>${accion}</em>`,
  ].join('<br>')
}

export function htmlPopupFoto(archivo: string, miniatura: string, detalle: string): string {
  return `<div class="popup-foto"><a href="${escapar(archivo)}" target="_blank" rel="noreferrer">`
    + `<img src="${escapar(miniatura)}" alt=""></a>${escapar(detalle)}</div>`
}
