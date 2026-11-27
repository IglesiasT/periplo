import { urlBandera } from '../banderas'

interface Props {
  /** Código del país en el mapa (ARG). */
  codigo: string | undefined
  /** Para el texto alternativo. */
  nombre: string
}

/** La bandera de un país, con el filtro del tema; nada si el país no tiene. */
export default function Bandera({ codigo, nombre }: Props) {
  const url = urlBandera(codigo)
  if (!url) return null
  return <img className="bandera" src={url} alt={`Bandera de ${nombre}`} />
}
