/**
 * Fechas para mostrar y para escribir. Todo trabaja sobre el texto ISO ('2026-01-15') sin pasar por Date,
 * que lo correría de día por la zona horaria.
 */

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/** '2026-01-15' -> 'Enero 2026'. */
export function mesAnio(iso: string | null): string {
  if (!iso) return ''
  const [anio, mes] = iso.split('-')
  return `${MESES[Number(mes) - 1]} ${anio}`
}

/** Cuándo fue un viaje, al mes: 'Enero 2026', 'Mayo – Junio 2026' o 'Diciembre 2025 – Enero 2026'. */
export function rangoMeses(inicio: string | null, fin: string | null): string {
  if (!inicio || !fin) return mesAnio(inicio ?? fin)
  const [anioInicio, mesInicio] = inicio.split('-')
  const [anioFin, mesFin] = fin.split('-')
  if (anioInicio !== anioFin) return `${mesAnio(inicio)} – ${mesAnio(fin)}`
  if (mesInicio !== mesFin) return `${MESES[Number(mesInicio) - 1]} – ${mesAnio(fin)}`
  return mesAnio(inicio)
}

/** '2026-01-15' -> '15/01/2026', para el campo donde se escribe. */
export function isoATexto(iso: string | null): string {
  if (!iso) return ''
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}

/** '15/01/2026' -> '2026-01-15'. Null si está incompleta o no existe (31/02). */
export function textoAIso(texto: string): string | null {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto)
  if (!partes) return null
  const [, dia, mes, anio] = partes
  const diasDelMes = new Date(Date.UTC(Number(anio), Number(mes), 0)).getUTCDate()
  if (Number(mes) < 1 || Number(mes) > 12 || Number(dia) < 1 || Number(dia) > diasDelMes) return null
  return `${anio}-${mes}-${dia}`
}

/** Pone las barras mientras se escribe: '1501' -> '15/01', '15012026' -> '15/01/2026'. */
export function enmascarar(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 8)
  if (digitos.length > 4) return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`
  if (digitos.length > 2) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`
  return digitos
}
