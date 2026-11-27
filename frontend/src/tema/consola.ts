/* "Consola": una sala de control. Grafito, una señal verde lima, todo en monoespaciada y con retícula. */
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'
import fuenteRotulos from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2?url'
import fuenteAgua from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-italic.woff2?url'
import type { Tema } from './tipos'

const papel = '#111311'
const tinta = '#e6eae2'
const lima = '#c8f135'
const cian = '#35d6f5'
const mar = '#0b0d0b'
const tierra = '#1d211d'
const borde = '#39413a'
const mono = "'JetBrains Mono', ui-monospace, monospace"

export const consola: Tema = {
  id: 'consola',
  nombre: 'Consola',
  esquema: 'dark',
  ui: {
    papel,
    panel: papel,
    papelHondo: '#1a1d1a',
    papelClaro: '#222622',
    borde,
    linea: '#2a2f2a',
    marco: borde,
    tinta,
    tenue: '#95a08f',
    sepia: '#7f8a79',
    carmin: lima,
    carminOscuro: lima,
    indigo: cian,
    activo: lima,
    activoTexto: '#0f1208',
    cifra: lima,
    aguada: mar,
    tierra,
    ok: '#4be0a0',
    campo: 'rgba(255, 255, 255, 0.04)',
    sombra: 'none',
    sombraTarjeta: 'none',
    velo: 'rgba(17, 19, 17, 0.8)',
  },
  fuentes: {
    texto: mono,
    titulo: mono,
    cursiva: mono,
    etiqueta: mono,
    cifra: mono,
    mapa: { versalitas: fuenteRotulos, cursiva: fuenteAgua },
  },
  forma: {
    tamBase: '13px',
    tamLogo: '20px',
    tamCifra: '38px',
    pesoCifra: '700',
    radio: '2px',
    radioControl: '2px',
    radioMarca: '0',
    pesoTitulo: '700',
    casoTitulo: 'uppercase',
    espaciadoTitulo: '3',
    espaciadoEtiqueta: '0.8',
    casoEtiqueta: 'uppercase',
    escalaEtiqueta: '0.85',
    estiloCursiva: 'normal',
    desenfoque: 'none',
    filtroIconos: 'invert(1)',
  },
  rasgos: { panel: 'fijo', pestanias: 'caja', sello: 'disco', rosa: false, lamina: 'hud' },
  voz: {
    lema: 'Registro de campo',
    cargando: 'Cargando capas…',
    completos: 'completos',
    completo: 'Completo',
    tituloLamina: '> registro de viajes',
  },
  mapa: {
    mar,
    noVisitado: tierra,
    fronteraPais: '#566056',
    fronteraProvincia: '#2e342e',
    reticula: '#1f251f',
    resaltado: '#ffffff',
    halo: mar,
    foto: cian,
    rotuloPais: '#a7b0a2',
    rotuloProvincia: '#d5dacf',
    rotuloAgua: '#5f6e62',
    haloRotulo: 'rgba(11, 13, 11, 0.85)',
    rotulos: { mayusculas: true, mayusculasAgua: false, espaciado: 0.5, escala: 0.85 },
  },
  estados: {
    visitada: lima,
    // Hogar: rosa de fósforo.
    hogar: '#ff6b9d',
    deseo: cian,
  },
  // Fósforos de pantalla para lo pisado y grafito apenas teñido para lo demás.
  // Sin el lima de lo visitado ni el cian del deseo: esos dos son la señal de la consola.
  aguadas: [
    ['#fe9da2', '#3b1c1e'], // frambuesa
    ['#ee8362', '#51332a'], // naranja
    ['#eeab43', '#3c2b12'], // ámbar fósforo
    ['#989575', '#3f3e33'], // arena
    ['#b3cea0', '#2d3727'], // musgo
    ['#46c19e', '#0d2e24'], // menta
    ['#749be7', '#303d56'], // azul radar
    ['#bdb7fe', '#25233c'], // lavanda
    ['#cd6ec5', '#422a40'], // magenta
    ['#afb0a5', '#2b2b27'], // fósforo blanco
  ],
}
