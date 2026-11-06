import type { EstadoRegion } from '../types'

/**
 * Un tema visual completo: todo color y toda fuente de la app sale de acá, y también la forma de la interfaz.
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
    /** Fondo del panel y las tarjetas sobre el mapa: el papel, o el papel translúcido si hay desenfoque. */
    panel: string
    papelHondo: string
    /** El marco de las fotos, un poco más claro que el papel. */
    papelClaro: string
    borde: string
    linea: string
    /** Los bordes marcados: botones, tarjetas, subrayado de los campos. */
    marco: string
    tinta: string
    tenue: string
    sepia: string
    /** El acento: lo visitado, el avance de los logros, el slider. */
    carmin: string
    /** El acento cuando es texto: tiene que leerse sobre el papel. */
    carminOscuro: string
    indigo: string
    /** Fondo de un botón activo y texto sobre él. */
    activo: string
    activoTexto: string
    /** Las cifras grandes del panel. */
    cifra: string
    aguada: string
    tierra: string
    ok: string
    /** Fondo de los campos de texto. */
    campo: string
    /** Sombra de los popups (un `box-shadow` entero). */
    sombra: string
    /** Sombra de las tarjetas sobre el mapa (un `box-shadow` entero, o `none`). */
    sombraTarjeta: string
    /** Papel semitransparente detrás de la escala y los créditos del mapa. */
    velo: string
  }
  fuentes: {
    /** Familias CSS: `--texto`, `--titulo`, `--cursiva`, `--etiqueta` y `--cifra`. */
    texto: string
    titulo: string
    cursiva: string
    /** Botones, pestañas, encabezados de sección y rótulos de los campos. */
    etiqueta: string
    /** Las cifras grandes del panel. */
    cifra: string
    /** Archivos que MapLibre rasteriza para los rótulos del mapa (sin servidor de glyphs). */
    mapa: { versalitas: string; cursiva: string }
  }
  /** Valores CSS de la forma de la interfaz. Como `ui`, cada uno es una variable: `radioControl` → `--radio-control`. */
  forma: {
    /** Tamaño del `rem`: los tamaños de letra de index.css son relativos a él. */
    tamBase: string
    /** "Periplo", arriba del panel. */
    tamLogo: string
    /** La cifra de países, junto al título. */
    tamCifra: string
    pesoCifra: string
    radio: string
    radioControl: string
    radioMarca: string
    pesoTitulo: string
    casoTitulo: string
    /** Multiplica el espaciado de letras de los títulos y las etiquetas. */
    espaciadoTitulo: string
    espaciadoEtiqueta: string
    casoEtiqueta: string
    /** Multiplica el tamaño de las etiquetas: una versalita y una mayúscula monoespaciada no ocupan lo mismo. */
    escalaEtiqueta: string
    /** `italic` o `normal`: las aclaraciones del panel. */
    estiloCursiva: string
    /** `backdrop-filter` del panel y las tarjetas. */
    desenfoque: string
    /** `filter` de los íconos de MapLibre, que son oscuros: `invert(1)` en un tema oscuro. */
    filtroIconos: string
  }
  /** Lo que no es un valor CSS: cambia el layout o qué se dibuja. */
  rasgos: {
    /** `fijo`: panel al costado del mapa. `flotante`: el mapa ocupa todo y el panel va encima. */
    panel: 'fijo' | 'flotante'
    pestanias: 'filete' | 'pastilla' | 'caja'
    /** Cómo se ve un logro completo: lacre con rosa de los vientos, o disco con tilde. */
    sello: 'lacre' | 'disco'
    /** Rosa de los vientos sobre el mapa. */
    rosa: boolean
  }
  /** Los textos que dependen de la personalidad del tema. */
  voz: {
    lema: string
    cargando: string
    /** "1 de 13 sellados". */
    completos: string
    /** Un logro completo. */
    completo: string
  }
  mapa: {
    mar: string
    /** Tierra sin visitar ni desear. */
    noVisitado: string
    fronteraPais: string
    fronteraProvincia: string
    /** Meridianos y paralelos sobre el mar; null, sin retícula. */
    reticula: string | null
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
    rotulos: {
      /** Países, provincias y entidades en mayúsculas. */
      mayusculas: boolean
      /** Océanos y mares en mayúsculas. */
      mayusculasAgua: boolean
      /** Multiplican el espaciado entre letras y el tamaño. */
      espaciado: number
      escala: number
    }
  }
  /** De más a menos tinta según la presencia; el deseo es el color de su contorno. */
  estados: Record<EstadoRegion, string>
  /** Paleta de las épocas: [entintada, diluida]. Cada entidad toma una según su nombre (ver historia.ts). */
  aguadas: [string, string][]
}
