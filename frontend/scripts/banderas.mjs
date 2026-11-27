// Copia las banderas de los países desde flag-icons (MIT) a public/banderas/, nombradas por el código del país
// en el mapa (ADM0_A3: ARG.svg), y escribe en src/banderasDisponibles.ts cuáles hay. El ISO de dos letras de
// cada país sale de public/geo/paises.geojson (lo escribe `manage.py descargar_natural_earth`).
//
// Uso, desde frontend/:  npm run banderas
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), '..')
const ORIGEN = join(FRONTEND, 'node_modules/flag-icons')
const DESTINO = join(FRONTEND, 'public/banderas')
const LISTA = join(FRONTEND, 'src/banderasDisponibles.ts')

const paises = JSON.parse(readFileSync(join(FRONTEND, 'public/geo/paises.geojson'), 'utf-8')).features
  .map((f) => f.properties)

rmSync(DESTINO, { recursive: true, force: true })
mkdirSync(DESTINO, { recursive: true })
copyFileSync(join(ORIGEN, 'LICENSE'), join(DESTINO, 'LICENSE'))

const copiadas = []
const sinBandera = []
for (const { codigo, nombre, iso_a2: iso } of paises) {
  const archivo = iso && join(ORIGEN, 'flags/4x3', `${iso.toLowerCase()}.svg`)
  if (archivo && existsSync(archivo)) {
    copyFileSync(archivo, join(DESTINO, `${codigo}.svg`))
    copiadas.push(codigo)
  } else {
    sinBandera.push(`${nombre} (${codigo})`)
  }
}
copiadas.sort()

writeFileSync(LISTA, [
  '// Generado por scripts/banderas.mjs (npm run banderas): no editar a mano.',
  '/** Los países con bandera en public/banderas/, por su código en el mapa. */',
  'export const BANDERAS: ReadonlySet<string> = new Set([',
  ...Array.from({ length: Math.ceil(copiadas.length / 12) },
    (_, i) => `  ${copiadas.slice(i * 12, i * 12 + 12).map((c) => `'${c}'`).join(', ')},`),
  '])',
  '',
].join('\n'))

console.log(`${copiadas.length} banderas en public/banderas/.`)
if (sinBandera.length) console.log(`Sin bandera: ${sinBandera.join(', ')}.`)
