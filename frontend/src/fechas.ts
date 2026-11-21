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

/**
 * Arma dd/mm/aaaa mientras se escribe: pone las barras ('15012026' -> '15/01/2026') y el cero que se suele
 * olvidar. Un día o mes de un dígito se completa al escribir la barra ('5/3/2024' -> '05/03/2024') o
 * apenas se sabe que no hay segundo dígito: un día que empieza en 4-9 o un mes que empieza en 2-9.
 */
export function enmascarar(texto: string): string {
  const partes = ['']
  for (const caracter of texto) {
    const i = partes.length - 1
    if (caracter === '/') {
      // Cierra un día o mes de un dígito; con la parte vacía (recién completada) la barra sobra.
      if (i < 2 && partes[i].length === 1) {
        partes[i] = `0${partes[i]}`
        partes.push('')
      }
      continue
    }
    if (!/\d/.test(caracter)) continue
    if (i === 2) {
      if (partes[i].length < 4) partes[i] += caracter
      continue
    }
    partes[i] += caracter
    const maximoPrimerDigito = i === 0 ? 3 : 1
    if (partes[i].length === 1 && Number(caracter) > maximoPrimerDigito) partes[i] = `0${caracter}`
    if (partes[i].length === 2) partes.push('')
  }
  return partes.filter(Boolean).join('/')
}
