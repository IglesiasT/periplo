/* "Órbita": la Tierra de noche vista desde un satélite. Lo visitado se enciende; lo demás queda a oscuras. */
import '@fontsource/geist-sans/300.css'
import '@fontsource/geist-sans/400.css'
import '@fontsource/geist-sans/500.css'
import '@fontsource/geist-sans/600.css'
import '@fontsource/geist-mono/400.css'
import '@fontsource/geist-mono/500.css'
import fuenteRotulos from '@fontsource/geist-sans/files/geist-sans-latin-500-normal.woff2?url'
import fuenteAgua from '@fontsource/geist-sans/files/geist-sans-latin-400-normal.woff2?url'
import type { Tema } from './tipos'

const papel = '#0e1014'
const tinta = '#eceef1'
const ambar = '#ffb347'
const azul = '#7fb4ff'
const mar = '#07090c'
const tierra = '#1b1f26'
const borde = '#2e333c'
const sombra = '0 12px 40px rgba(0, 0, 0, 0.5)'
const sans = "'Geist Sans', system-ui, sans-serif"
const mono = "'Geist Mono', ui-monospace, monospace"

export const orbita: Tema = {
  id: 'orbita',
  nombre: 'Órbita',
  esquema: 'dark',
  ui: {
    papel,
    panel: 'rgba(14, 16, 20, 0.84)',
    papelHondo: '#181b21',
    papelClaro: '#1e222a',
    borde,
    linea: '#262a32',
    marco: borde,
    tinta,
    tenue: '#9aa2ad',
    sepia: '#7e8792',
    carmin: ambar,
    carminOscuro: ambar,
    indigo: azul,
    activo: ambar,
    activoTexto: '#17120a',
    cifra: ambar,
    aguada: mar,
    tierra,
    ok: '#7fb685',
    campo: 'rgba(255, 255, 255, 0.05)',
    sombra,
    sombraTarjeta: sombra,
    velo: 'rgba(14, 16, 20, 0.75)',
  },
  fuentes: {
    texto: sans,
    titulo: sans,
    cursiva: sans,
    etiqueta: mono,
    cifra: sans,
    mapa: { versalitas: fuenteRotulos, cursiva: fuenteAgua },
  },
  forma: {
    tamBase: '14px',
    tamLogo: '22px',
    tamCifra: '44px',
    pesoCifra: '300',
    radio: '14px',
    radioControl: '8px',
    radioMarca: '50%',
    pesoTitulo: '600',
    casoTitulo: 'none',
    espaciadoTitulo: '0',
    espaciadoEtiqueta: '1.2',
    casoEtiqueta: 'uppercase',
    escalaEtiqueta: '0.8',
    estiloCursiva: 'normal',
    desenfoque: 'blur(18px)',
    filtroIconos: 'invert(1)',
  },
  rasgos: { panel: 'flotante', pestanias: 'pastilla', sello: 'disco', rosa: false, lamina: 'cartela' },
  voz: {
    lema: 'Vistos desde arriba',
    cargando: 'Bajando las imágenes…',
    completos: 'completados',
    completo: 'Completado',
    tituloLamina: 'Bitácora orbital',
  },
  mapa: {
    mar,
    noVisitado: tierra,
    fronteraPais: '#454d59',
    fronteraProvincia: '#2a2f37',
    reticula: null,
    resaltado: '#ffffff',
    halo: mar,
    foto: '#ffffff',
    rotuloPais: '#aeb5bf',
    rotuloProvincia: '#d2d6dc',
    rotuloAgua: '#66717f',
    haloRotulo: 'rgba(7, 9, 12, 0.8)',
    rotulos: { mayusculas: true, mayusculasAgua: true, espaciado: 1, escala: 0.85 },
  },
  estados: {
    visitada: ambar,
    // Hogar: rosa, cálido como lo visitado pero aparte.
    hogar: '#e85d9a',
    deseo: azul,
  },
  // Sobre fondo oscuro, la entintada es la encendida y la diluida apenas se separa de la tierra:
  // de noche, solo lo pisado se prende. Ninguna se acerca al ámbar de lo visitado ni al azul del deseo.
  aguadas: [
    ['#bcc5cd', '#2a2e32'], // plata
    ['#e08a76', '#3c2823'], // sodio
    ['#b7b269', '#292818'], // lima pálida
    ['#79a76a', '#303c2c'], // aurora
    ['#77cbb2', '#22362f'], // jade
    ['#57a8a4', '#182c2b'], // cian helado
    ['#ab9c83', '#38332c'], // arena
    ['#d6bcff', '#2c2537'], // violeta
    ['#af86c1', '#372c3c'], // lila
    ['#e8a0c8', '#44323b'], // rosa
  ],
}
