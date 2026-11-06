/* "Matriz": blanco, negro y un solo rojo, con los títulos y las cifras en una matriz de puntos. */
import '@fontsource/doto/900.css'
import '@fontsource/geist-sans/400.css'
import '@fontsource/geist-sans/500.css'
import '@fontsource/geist-sans/600.css'
import '@fontsource/geist-mono/400.css'
import '@fontsource/geist-mono/500.css'
import fuenteRotulos from '@fontsource/geist-mono/files/geist-mono-latin-500-normal.woff2?url'
import fuenteAgua from '@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff2?url'
import type { Tema } from './tipos'

const papel = '#f1f0ec'
const negro = '#0a0a0a'
const rojo = '#e3241b'
const mar = '#f7f6f3'
const tierra = '#deddd6'
const doto = "'Doto', ui-monospace, monospace"
const mono = "'Geist Mono', ui-monospace, monospace"

export const matriz: Tema = {
  id: 'matriz',
  nombre: 'Matriz',
  esquema: 'light',
  ui: {
    papel,
    panel: papel,
    papelHondo: '#e4e3dd',
    papelClaro: '#fafaf8',
    borde: negro,
    linea: '#cfcec7',
    marco: negro,
    tinta: negro,
    tenue: '#5c5b57',
    sepia: '#6d6c67',
    carmin: rojo,
    carminOscuro: '#b81a12',
    indigo: negro,
    activo: negro,
    activoTexto: papel,
    cifra: rojo,
    aguada: mar,
    tierra,
    ok: '#0b7a54',
    campo: 'rgba(255, 255, 255, 0.5)',
    sombra: 'none',
    sombraTarjeta: 'none',
    velo: 'rgba(241, 240, 236, 0.85)',
  },
  fuentes: {
    texto: "'Geist Sans', system-ui, sans-serif",
    titulo: doto,
    cursiva: "'Geist Sans', system-ui, sans-serif",
    etiqueta: mono,
    cifra: doto,
    mapa: { versalitas: fuenteRotulos, cursiva: fuenteAgua },
  },
  forma: {
    tamBase: '14px',
    tamLogo: '30px',
    tamCifra: '56px',
    pesoCifra: '900',
    radio: '0',
    radioControl: '16px',
    radioMarca: '50%',
    pesoTitulo: '900',
    casoTitulo: 'uppercase',
    espaciadoTitulo: '0',
    espaciadoEtiqueta: '1',
    casoEtiqueta: 'uppercase',
    escalaEtiqueta: '0.8',
    estiloCursiva: 'normal',
    desenfoque: 'none',
    filtroIconos: 'none',
  },
  rasgos: { panel: 'fijo', pestanias: 'pastilla', sello: 'disco', rosa: false },
  voz: {
    lema: 'Sistema de viajes',
    cargando: 'Cargando…',
    completos: 'completos',
    completo: 'Completo',
  },
  mapa: {
    mar,
    noVisitado: tierra,
    fronteraPais: negro,
    fronteraProvincia: '#bdbcb4',
    reticula: null,
    resaltado: negro,
    halo: mar,
    foto: negro,
    rotuloPais: '#1a1a1a',
    rotuloProvincia: '#1a1a1a',
    rotuloAgua: '#807f79',
    haloRotulo: 'rgba(247, 246, 243, 0.85)',
    rotulos: { mayusculas: true, mayusculasAgua: true, espaciado: 0.6, escala: 0.8 },
  },
  estados: {
    estadia: rojo,
    paso: '#ee6f67',
    transito: '#f5aea8',
    deseo: negro,
  },
  aguadas: [
    ['#e3241b', '#f4b7b3'], // rojo
    ['#1f4fe0', '#bccaf5'], // azul
    ['#0a0a0a', '#abaaa5'], // negro
    ['#f2b705', '#f8e3a0'], // amarillo
    ['#0e9f6e', '#b3e0cf'], // verde
    ['#8b3fd9', '#d9c3f2'], // violeta
    ['#ff7a1a', '#fbd2b3'], // naranja
    ['#0fb5c9', '#b5e6ec'], // cian
    ['#e23d9b', '#f6c1df'], // magenta
    ['#7a7a45', '#d2d2b5'], // oliva
  ],
}
