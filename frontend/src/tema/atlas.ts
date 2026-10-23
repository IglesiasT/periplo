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
    papelHondo: '#e8dcc2',
    papelClaro: '#fbf7ee',
    borde: '#c9b48e',
    linea: '#dccbaa',
    tinta,
    tenue: '#6b5a43',
    sepia,
    carmin,
    carminOscuro: '#7e2a21',
    indigo,
    aguada,
    tierra,
    ok: '#4f6b3a',
    campo: 'rgba(255, 255, 255, 0.35)',
    sombra: 'rgba(43, 33, 23, 0.18)',
    velo,
  },
  fuentes: {
    texto: "'EB Garamond', Georgia, serif",
    titulo: "'IM Fell English SC', 'EB Garamond', Georgia, serif",
    cursiva: "'IM Fell English', 'EB Garamond', Georgia, serif",
    mapa: { versalitas: fuenteVersalitas, cursiva: fuenteCursiva },
  },
  mapa: {
    mar: aguada,
    noVisitado: tierra,
    fronteraPais: sepia,
    fronteraProvincia: '#bfae8c',
    resaltado: tinta,
    halo: papel,
    foto: tinta,
    rotuloPais: '#4f4232',
    rotuloProvincia: '#3b2f22',
    rotuloAgua: '#4d6b63',
    haloRotulo: velo,
  },
  // De más a menos tinta, como un atlas coloreado a mano. El deseo no se rellena: solo lleva un contorno.
  estados: {
    estadia: carmin,
    paso: '#cf7356',
    transito: '#e7a98a',
    deseo: indigo,
  },
  // Las aguadas de un atlas coloreado a mano. Sin rojos puros, para no confundirse con el carmín de las visitas.
  aguadas: [
    ['#c49a4a', '#e6d3a8'], // ocre
    ['#8a9a5b', '#cfd6b4'], // salvia
    ['#b9714f', '#e3c2ae'], // siena
    ['#6f8aa1', '#c4d0da'], // pizarra
    ['#a07a9a', '#dccbd8'], // malva
    ['#7f9c8c', '#c9d8cf'], // verde agua
    ['#9c7b56', '#d9c7b0'], // tierra de sombra
    ['#b58f8a', '#e4d0cc'], // rosa viejo
    ['#8c8f6a', '#d1d2bb'], // oliva
    ['#c0a35c', '#e8dcb5'], // mostaza
  ],
}
