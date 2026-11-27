/* "Cristal": un mapa claro de app actual, con el panel esmerilado flotando encima. */
import '@fontsource/figtree/400.css'
import '@fontsource/figtree/400-italic.css'
import '@fontsource/figtree/500.css'
import '@fontsource/figtree/600.css'
import '@fontsource/figtree/700.css'
import fuenteRotulos from '@fontsource/figtree/files/figtree-latin-600-normal.woff2?url'
import fuenteAgua from '@fontsource/figtree/files/figtree-latin-400-italic.woff2?url'
import type { Tema } from './tipos'

const papel = '#f6f7f9'
const tinta = '#14171c'
const cobalto = '#2457f5'
const magenta = '#d6336c'
const mar = '#d6e3ee'
const tierra = '#f8f7f4'
const borde = '#d4d8df'
const sombra = '0 10px 36px rgba(30, 45, 80, 0.16)'
const figtree = "'Figtree', system-ui, sans-serif"

export const cristal: Tema = {
  id: 'cristal',
  nombre: 'Cristal',
  esquema: 'light',
  ui: {
    papel,
    panel: 'rgba(250, 251, 253, 0.8)',
    papelHondo: '#e9ecf1',
    papelClaro: '#ffffff',
    borde,
    linea: '#e3e6eb',
    marco: borde,
    tinta,
    tenue: '#596170',
    sepia: '#6b7280',
    carmin: cobalto,
    carminOscuro: '#1c45c9',
    indigo: magenta,
    activo: cobalto,
    activoTexto: '#ffffff',
    cifra: cobalto,
    aguada: mar,
    tierra,
    ok: '#1f7a56',
    campo: 'rgba(255, 255, 255, 0.6)',
    sombra,
    sombraTarjeta: sombra,
    velo: 'rgba(250, 251, 253, 0.75)',
  },
  fuentes: {
    texto: figtree,
    titulo: figtree,
    cursiva: figtree,
    etiqueta: figtree,
    cifra: figtree,
    mapa: { versalitas: fuenteRotulos, cursiva: fuenteAgua },
  },
  forma: {
    tamBase: '14.5px',
    tamLogo: '24px',
    tamCifra: '40px',
    pesoCifra: '700',
    radio: '20px',
    radioControl: '11px',
    radioMarca: '50%',
    pesoTitulo: '700',
    casoTitulo: 'none',
    espaciadoTitulo: '0',
    espaciadoEtiqueta: '0',
    casoEtiqueta: 'none',
    escalaEtiqueta: '0.9',
    estiloCursiva: 'normal',
    desenfoque: 'blur(24px) saturate(1.5)',
    filtroIconos: 'none',
    filtroBandera: 'none',
  },
  rasgos: { panel: 'flotante', pestanias: 'pastilla', sello: 'disco', rosa: false },
  voz: {
    lema: 'Tu mapa del mundo',
    cargando: 'Cargando el mapa…',
    completos: 'completados',
    completo: 'Completado',
  },
  mapa: {
    mar,
    noVisitado: tierra,
    fronteraPais: '#aeb5bd',
    fronteraProvincia: '#e4e3dd',
    reticula: null,
    resaltado: tinta,
    halo: '#ffffff',
    foto: tinta,
    rotuloPais: '#535b66',
    rotuloProvincia: '#2c3138',
    rotuloAgua: '#5e7f9b',
    haloRotulo: 'rgba(248, 247, 244, 0.85)',
    rotulos: { mayusculas: false, mayusculasAgua: false, espaciado: 0.3, escala: 1 },
  },
  estados: {
    visitada: cobalto,
    // Hogar: verde agua.
    hogar: '#0f8f7e',
    deseo: magenta,
  },
  // Más suaves que el cobalto de lo visitado, y lejos del magenta del deseo.
  aguadas: [
    ['#bc644a', '#eac9bf'], // coral
    ['#d78355', '#fee1d2'], // naranja
    ['#b6a23f', '#ebe1b2'], // amarillo
    ['#8d8e42', '#eef0cd'], // oliva
    ['#5ab78c', '#d0efde'], // verde
    ['#3c9b85', '#c1e1d8'], // turquesa
    ['#549ec1', '#bad4e2'], // cielo
    ['#977dcd', '#d9d0ef'], // violeta
    ['#c19bd0', '#f5e4fc'], // lila
    ['#738195', '#dae1ec'], // pizarra
  ],
}
