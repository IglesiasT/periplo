import { useState } from 'react'

const PREFIJO = 'periplo.borrador.'

// Sin almacenamiento (ventana privada, disco lleno) se pierde la red de seguridad, no la app.
export function leerBorrador<T>(clave: string): T | null {
  try {
    const texto = localStorage.getItem(PREFIJO + clave)
    return texto === null ? null : (JSON.parse(texto) as T)
  } catch {
    return null
  }
}

/** null lo borra. */
export function escribirBorrador<T>(clave: string, valor: T | null) {
  try {
    if (valor === null) localStorage.removeItem(PREFIJO + clave)
    else localStorage.setItem(PREFIJO + clave, JSON.stringify(valor))
  } catch {
    // Ver arriba: el borrador sigue vivo en memoria mientras el componente esté montado.
  }
}

/**
 * Lo que se está escribiendo y todavía no se guardó, a salvo en el navegador: sobrevive a hacer click
 * en otra región, a volver atrás y a cerrar la pestaña. Se borra al guardar o descartar.
 * La clave se lee al montar: quien la cambie tiene que volver a montarse (key).
 */
export function useBorrador<T>(clave: string) {
  const [valor, setValor] = useState<T | null>(() => leerBorrador<T>(clave))
  const cambiar = (nuevo: T | null) => {
    setValor(nuevo)
    escribirBorrador(clave, nuevo)
  }
  return [valor, cambiar] as const
}
