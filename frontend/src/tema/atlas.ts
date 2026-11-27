/* Dirección "Atlas de gabinete": papel, tinta de grabador y aguadas, como un atlas del siglo XIX. */
// Fuentes servidas desde node_modules (sin pedirle nada a Google): títulos en IM Fell, texto en EB Garamond.
import '@fontsource/eb-garamond/400.css'
import '@fontsource/eb-garamond/400-italic.css'
import '@fontsource/eb-garamond/500.css'
import '@fontsource/eb-garamond/600.css'
import '@fontsource/im-fell-english/400.css'
import '@fontsource/im-fell-english/400-italic.css'
import '@fontsource/im-fell-english-sc/400.css'
// Para el mapa, los archivos sueltos: con `?url` Vite los copia tal cual y da su URL.
import fuenteVersalitas from '@fontsource/im-fell-english-sc/files/im-fell-english-sc-latin-400-normal.woff2?url'
import fuenteCursiva from '@fontsource/im-fell-english/files/im-fell-english-latin-400-italic.woff2?url'
import type { Tema } from './tipos'

const papel = '#f3ebda'
const tinta = '#2b2117'
const sepia = '#7c6a50'
const carmin = '#a8382c'
const indigo = '#3e5c76'
const aguada = '#c6d4cc'
const tierra = '#eee4ce'
// Papel al 85%: el contorno de los rótulos y el fondo de la escala y los créditos.
const velo = 'rgba(243, 235, 218, 0.85)'

export const atlas: Tema = {
  id: 'atlas',
  nombre: 'Atlas de gabinete',
  esquema: 'light',
  ui: {
    papel,
    panel: papel,
    papelHondo: '#e8dcc2',
    papelClaro: '#fbf7ee',
    borde: '#c9b48e',
    linea: '#dccbaa',
    marco: tinta,
    tinta,
    tenue: '#6b5a43',
    sepia,
    carmin,
    carminOscuro: '#7e2a21',
    indigo,
    activo: tinta,
    activoTexto: papel,
    cifra: tinta,
    aguada,
    tierra,
    ok: '#4f6b3a',
    campo: 'rgba(255, 255, 255, 0.35)',
    sombra: '3px 3px 0 rgba(43, 33, 23, 0.18)',
    sombraTarjeta: 'none',
    velo,
  },
  fuentes: {
    texto: "'EB Garamond', Georgia, serif",
    titulo: "'IM Fell English SC', 'EB Garamond', Georgia, serif",
    cursiva: "'IM Fell English', 'EB Garamond', Georgia, serif",
    etiqueta: "'IM Fell English SC', 'EB Garamond', Georgia, serif",
    cifra: "'EB Garamond', Georgia, serif",
    mapa: { versalitas: fuenteVersalitas, cursiva: fuenteCursiva },
  },
  forma: {
    tamBase: '16px',
    tamLogo: '38px',
    tamCifra: '19px',
    pesoCifra: '400',
    radio: '0',
    radioControl: '0',
    radioMarca: '0',
    pesoTitulo: '400',
    casoTitulo: 'none',
    espaciadoTitulo: '1',
    espaciadoEtiqueta: '1',
    casoEtiqueta: 'none',
    escalaEtiqueta: '1',
    estiloCursiva: 'italic',
    desenfoque: 'none',
    filtroIconos: 'none',
  },
  rasgos: { panel: 'fijo', pestanias: 'filete', sello: 'lacre', rosa: true, lamina: 'cartela' },
  voz: {
    lema: 'Atlas y diario de viajes',
    cargando: 'Grabando las planchas del mapa…',
    completos: 'sellados',
    completo: 'Sellado',
    tituloLamina: 'Mi periplo',
  },
  mapa: {
    mar: aguada,
    noVisitado: tierra,
    fronteraPais: sepia,
    fronteraProvincia: '#bfae8c',
    reticula: null,
    resaltado: tinta,
    halo: papel,
    foto: tinta,
    rotuloPais: '#4f4232',
    rotuloProvincia: '#3b2f22',
    rotuloAgua: '#4d6b63',
    haloRotulo: velo,
    rotulos: { mayusculas: false, mayusculasAgua: false, espaciado: 1, escala: 1 },
  },
  // Lo visitado va entintado, como un atlas coloreado a mano. El deseo no se rellena: solo lleva un contorno.
  estados: {
    visitada: carmin,
    // Hogar: verde oliva, otra tinta de la misma caja.
    hogar: '#4a6a2c',
    deseo: indigo,
  },
  // Las aguadas de un atlas coloreado a mano. Sin rojos puros, para no confundirse con el carmín de las visitas.
  // Cada una de otra familia de color: el backend reparte los tonos para que dos vecinas no repitan número,
  // y si dos aguadas se parecieran (un ocre y una mostaza), las vecinas igual se confundirían.
  aguadas: [
    ['#ad8a3c', '#e0cda7'], // ocre
    ['#8ea26f', '#cedabd'], // salvia
    ['#b87459', '#e7c1b3'], // siena
    ['#7896b3', '#c6d7e8'], // pizarra
    ['#af89aa', '#e3cee0'], // malva
    ['#628e87', '#b7d6d0'], // verde agua
    ['#b99378', '#edd1be'], // tierra de sombra
    ['#986d74', '#d6babe'], // rosa viejo
    ['#7d8651', '#c5cba8'], // oliva
    ['#9d720a', '#ddc08d'], // amarillo paja
  ],
}
