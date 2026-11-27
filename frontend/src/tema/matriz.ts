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
    filtroBandera: 'grayscale(1) contrast(1.15)',
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
    visitada: rojo,
    // Hogar: rojo quemado, más oscuro que lo visitado.
    hogar: '#7a0f0a',
    deseo: negro,
  },
  // Grises teñidos: el único rojo del mapa es lo visitado y el negro es la tinta.
  aguadas: [
    ['#4e697d', '#bac5cd'], // grafito azul
    ['#668691', '#c6d2d6'], // pizarra
    ['#3f5a4b', '#b3bdb7'], // verde gris
    ['#6a7154', '#c4c7bb'], // liquen
    ['#89785d', '#c1b9ae'], // arena
    ['#716158', '#d3ccc8'], // humo
    ['#5f4b5e', '#c9c1c9'], // ciruela gris
    ['#797993', '#c9c9d3'], // lavanda gris
    ['#557d79', '#bdccca'], // petróleo
    ['#5a5a5a', '#bfbfbf'], // gris neutro
  ],
}
