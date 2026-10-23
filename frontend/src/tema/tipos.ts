import type { EstadoRegion } from '../types'

/**
 * Un tema visual completo: todo color y toda fuente de la app sale de acá.
 * El panel los lee como variables CSS (ver `variablesCss`); el mapa, que MapLibre pinta en un canvas
 * y no entiende de variables CSS, los recibe en `crearEstilo`.
 */
export interface Tema {
  id: string
  nombre: string
  /** `color-scheme` del documento: los controles nativos (barras de scroll, selects) claros u oscuros. */
  esquema: 'light' | 'dark'
  /** Colores del panel y los controles. Cada uno es una variable CSS: `papelHondo` → `--papel-hondo`. */
  ui: {
    papel: string
    papelHondo: string
    /** El marco de las fotos, un poco más claro que el papel. */
    papelClaro: string
    borde: string
    linea: string
    tinta: string
    tenue: string
    sepia: string
    carmin: string
    carminOscuro: string
    indigo: string
    aguada: string
    tierra: string
    ok: string
    /** Fondo de los campos de texto. */
    campo: string
    /** Sombra de los popups. */
    sombra: string
    /** Papel semitransparente detrás de la escala y los créditos del mapa. */
    velo: string
  }
  fuentes: {
    /** Familias CSS: `--texto`, `--titulo` y `--cursiva`. */
    texto: string
    titulo: string
    cursiva: string
    /** Archivos que MapLibre rasteriza para los rótulos del mapa (sin servidor de glyphs). */
    mapa: { versalitas: string; cursiva: string }
  }
  mapa: {
    mar: string
    /** Tierra sin visitar ni desear. */
    noVisitado: string
    fronteraPais: string
    fronteraProvincia: string
    /** Trazo del resaltado de lo elegido. */
    resaltado: string
    /** Claro alrededor de lo que va encima de todo: debajo del resaltado y en el borde de las fotos. */
    halo: string
    foto: string
    rotuloPais: string
    rotuloProvincia: string
    rotuloAgua: string
    /** Contorno de las letras de los rótulos, para que se lean sobre cualquier relleno. */
    haloRotulo: string
  }
  /** De más a menos tinta según la presencia; el deseo es el color de su contorno. */
  estados: Record<EstadoRegion, string>
  /** Paleta de las épocas: [entintada, diluida]. Cada entidad toma una según su nombre (ver historia.ts). */
  aguadas: [string, string][]
}
