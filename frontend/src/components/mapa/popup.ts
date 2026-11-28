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

interface PopupEntidad {
  /** La entidad de la época que ocupaba lo que está bajo el mouse. */
  nombre: string
  /** Si pisé su territorio en alguna visita realizada. */
  pisada: boolean
  marcando: boolean
}

/** El popup en un año, de lejos: el mapa se lee como países, así que se nombra la entidad, sin la bandera de hoy.
 *  El click va al país de hoy, que es el que tiene ficha. */
export function htmlPopupEntidad({ nombre, pisada, marcando }: PopupEntidad): string {
  const accion = marcando ? 'Click para marcar el país de hoy' : 'Click para abrir la ficha del país de hoy'
  return [
    `<strong>${escapar(nombre)}</strong>`,
    pisada ? 'Pisaste su territorio' : 'Sin pisar',
    `<em>${accion}</em>`,
  ].join('<br>')
}

export function htmlPopupFoto(archivo: string, miniatura: string, detalle: string): string {
  return `<div class="popup-foto"><a href="${escapar(archivo)}" target="_blank" rel="noreferrer">`
    + `<img src="${escapar(miniatura)}" alt=""></a>${escapar(detalle)}</div>`
}
