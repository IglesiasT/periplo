// Recorre la app de verdad en un Chrome sin ventana, con un perfil temporal: lo que los tests de funciones sueltas
// no ven, sobre todo que el viaje elegido siga resaltado. Necesita los dos servidores prendidos.
// Solo mira: no guarda nada, así que se puede correr contra la base de siempre.
//
// Uso: npm run e2e
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.PERIPLO_URL ?? 'http://localhost:5173'
const PUERTO = 9335
const CHROMES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]

const chromePath = CHROMES.find((ruta) => ruta && existsSync(ruta))
if (!chromePath) {
  console.log('omitido: no hay Chrome en esta máquina (se puede indicar con CHROME=ruta)')
  process.exit(0)
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const perfil = mkdtempSync(join(tmpdir(), 'periplo-recorrido-'))
const chrome = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`, '--window-size=1400,900',
  ...(process.platform === 'win32' ? ['--use-angle=d3d11', '--ignore-gpu-blocklist'] : []),
  '--no-first-run', '--disable-extensions', 'about:blank',
], { stdio: 'ignore' })

async function conectar() {
  for (let i = 0; i < 80; i++) {
    try {
      const pestanas = await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json()
      const pagina = pestanas.find((t) => t.type === 'page')
      if (pagina) return pagina.webSocketDebuggerUrl
    } catch { /* todavía no levantó */ }
    await espera(250)
  }
  throw new Error('Chrome no levantó')
}

let fallas = 0
function comprobar(nombre, condicion, detalle = '') {
  console.log(`${condicion ? 'ok   ' : 'FALLA'}  ${nombre}${!condicion && detalle ? `: ${detalle}` : ''}`)
  if (!condicion) fallas++
}

try {
  const ws = new WebSocket(await conectar())
  await new Promise((r) => { ws.onopen = r })
  let id = 0
  const pendientes = new Map()
  const excepciones = []
  ws.onmessage = (evento) => {
    const m = JSON.parse(evento.data)
    if (m.id && pendientes.has(m.id)) {
      pendientes.get(m.id)(m)
      pendientes.delete(m.id)
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const { text, exception } = m.params.exceptionDetails
      excepciones.push(exception?.description ?? text)
    }
  }
  const cdp = (method, params = {}) => new Promise((r) => {
    const n = ++id
    pendientes.set(n, r)
    ws.send(JSON.stringify({ id: n, method, params }))
  })
  const evaluar = async (expression) => {
    const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error(`${expression}: ${r.result.exceptionDetails.exception?.description}`)
    return r.result?.result?.value
  }
  const hasta = async (expression, ms = 30000) => {
    const inicio = Date.now()
    while (Date.now() - inicio < ms) {
      if (await evaluar(`Boolean(${expression})`)) return true
      await espera(50)
    }
    return false
  }
  const abrir = async (ruta) => {
    await cdp('Page.navigate', { url: BASE + ruta })
    await espera(200)
    return hasta("window.__mapaPeriplo && document.querySelector('.mapa') && !document.querySelector('.cargando')")
  }
  // Elegir algo pide su encuadre y recién entonces el mapa empieza a moverse: con el servidor recién prendido,
  // puede tardar. Clickear antes de que termine cae en cualquier lado (el mapa se mueve debajo del punto).
  const mapaQuieto = async () => {
    await hasta("performance.getEntriesByType('resource').some((r) => r.name.includes('/api/encuadre/') && r.responseEnd > 0)", 10000)
    await espera(100)
    return hasta('!window.__mapaPeriplo.isMoving() && window.__mapaPeriplo.loaded()', 15000)
  }
  const clickEnBoton = (texto) => evaluar(`(() => {
    const boton = [...document.querySelectorAll('.panel button')].find((b) => b.textContent.includes(${JSON.stringify(texto)}))
    boton.click()
    return true
  })()`)
  const titulo = () => evaluar("document.querySelector('.panel h2')?.textContent ?? null")
  // Los estados se aplican a todas las fuentes: con mirar una alcanza.
  const resaltado = (codigo) =>
    evaluar(`window.__mapaPeriplo.getFeatureState({ source: 'paises', id: ${JSON.stringify(codigo)} }).resaltada ?? null`)

  await cdp('Page.enable')
  await cdp('Runtime.enable')

  comprobar('el mapa carga', await abrir('/'))
  const viajes = await evaluar("fetch('/api/viajes/').then((r) => r.json())")
  const viaje = viajes?.find((v) => v.visitas.length > 0)
  if (!viaje) {
    console.log('omitido el resto: la base no tiene viajes con regiones')
    process.exit(0)
  }
  const regiones = viaje.visitas.map((v) => v.region)
  const contiene = viaje.visitas.flatMap((v) => v.region_ancestros).find((c) => !regiones.includes(c))
  const estaResaltado = async () => {
    const estados = await Promise.all(regiones.map(resaltado))
    return estados.every((e) => e === 'directa')
  }

  comprobar('elegir un viaje desde la lista', await (async () => {
    await clickEnBoton(viaje.nombre)
    return hasta(`location.search === '?viaje=${viaje.id}' && document.querySelector('.panel h2')?.textContent === ${JSON.stringify(viaje.nombre)}`, 5000)
  })())
  comprobar('el viaje queda resaltado', await estaResaltado())
  if (contiene) comprobar('lo que lo contiene se marca aparte', (await resaltado(contiene)) === 'contiene')

  for (const pestania of ['Números', 'Logros', 'Fichas', 'Viajes']) {
    await clickEnBoton(pestania)
    await espera(150)
    const activa = await evaluar("document.querySelector('.pestanias .activa')?.textContent")
    comprobar(`en la pestaña ${pestania} el viaje sigue resaltado`, activa === pestania && await estaResaltado(), `activa: ${activa}`)
  }

  // Un click de verdad en el mapa, en una región que no sea del viaje.
  comprobar('el mapa llega al viaje', await mapaQuieto())
  const punto = await evaluar(`(() => {
    const map = window.__mapaPeriplo
    const { clientWidth: ancho, clientHeight: alto } = map.getCanvas()
    const propias = ${JSON.stringify(regiones)}
    for (let x = 0.3; x < 0.95; x += 0.05) {
      for (let y = 0.3; y < 0.8; y += 0.05) {
        const [f] = map.queryRenderedFeatures([ancho * x, alto * y], { layers: ['departamentos-relleno', 'provincias-relleno', 'paises-relleno'] })
        if (f && !propias.includes(f.properties.codigo) && !f.state.resaltada) {
          const caja = map.getCanvas().getBoundingClientRect()
          return { x: caja.left + ancho * x, y: caja.top + alto * y }
        }
      }
    }
    return null
  })()`)
  comprobar('hay una región ajena para clickear', Boolean(punto))
  if (punto) {
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await cdp('Input.dispatchMouseEvent', { type, x: punto.x, y: punto.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: type === 'mouseMoved' ? 0 : 1 })
    }
    comprobar('un click en el mapa abre la ficha sin soltar el viaje', await hasta(`new URLSearchParams(location.search).has('region') && new URLSearchParams(location.search).get('viaje') === '${viaje.id}'`, 5000))
    comprobar('el enlace vuelve al viaje', (await evaluar("document.querySelector('.panel .volver')?.textContent ?? ''")).includes(viaje.nombre))
    comprobar('con la ficha abierta el viaje sigue resaltado', await estaResaltado())
    const region = await evaluar("new URLSearchParams(location.search).get('region')")
    comprobar('la región de la ficha se resalta también', (await resaltado(region)) === 'directa')
    await clickEnBoton('Volver a')
    comprobar('volver cierra la ficha y deja el viaje', await hasta(`location.search === '?viaje=${viaje.id}'`, 3000) && (await titulo()) === viaje.nombre)
    comprobar('la región de la ficha deja de resaltarse', await hasta(`window.__mapaPeriplo.getFeatureState({ source: 'paises', id: ${JSON.stringify(region)} }).resaltada == null`, 3000))
  }

  await evaluar('history.back()')
  comprobar('Atrás reabre lo anterior', await hasta("new URLSearchParams(location.search).has('region')", 3000))
  await evaluar('history.forward()')
  await hasta(`location.search === '?viaje=${viaje.id}'`, 3000)

  await clickEnBoton('Marcar en el mapa')
  comprobar('el modo de marcar se prende', await hasta("[...document.querySelectorAll('.panel button')].some((b) => b.textContent === 'Listo')", 2000))
  await clickEnBoton('Números')
  await clickEnBoton('Viajes')
  comprobar('cambiar de pestaña lo apaga', await hasta("[...document.querySelectorAll('.panel button')].some((b) => b.textContent === 'Marcar en el mapa')", 2000))

  await clickEnBoton('← Viajes')
  comprobar('"← Viajes" deselecciona', await hasta("!new URLSearchParams(location.search).has('viaje')", 2000)
    && await hasta(`window.__mapaPeriplo.getFeatureState({ source: 'paises', id: ${JSON.stringify(regiones[0])} }).resaltada == null`, 2000))

  const sueltas = await evaluar("fetch('/api/visitas/?viaje=ninguno').then((r) => r.json())")
  if (sueltas?.length) {
    comprobar('los lugares sueltos están en la lista', await hasta("[...document.querySelectorAll('.panel h3')].some((h) => h.textContent === 'Lugares sueltos')", 3000))
    await clickEnBoton(sueltas[0].region_nombre)
    comprobar('un lugar suelto abre su ficha', await hasta(`new URLSearchParams(location.search).get('region') === ${JSON.stringify(sueltas[0].region)}`, 3000))
    await clickEnBoton('Volver a')
  }

  // Un pedido de escritura inválido: la app pasa el control de origen y lo rechaza la validación, sin guardar nada.
  const estado = await evaluar("fetch('/api/viajes/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.status)")
  comprobar('la app puede escribir en la API', estado === 400, `respondió ${estado}`)

  const anios = await evaluar("fetch('/api/historia/').then((r) => r.json())")
  if (anios?.length) {
    const anio = anios[anios.length - 2]
    comprobar('un enlace a un año lo abre', await abrir(`/?anio=${anio}#2/0/0`) && await hasta(`document.querySelector('.epoca-anio')?.textContent === '${anio}' && document.querySelector('.epoca-panel')`, 5000))
    await evaluar("document.querySelector('.epoca-panel summary').click()")
    comprobar('el panel de entidades se pliega', await hasta("!document.querySelector('.epoca-panel').open", 1000))
    await evaluar("document.querySelector('.epoca-mandos button[aria-label=\"Año siguiente\"]').click()")
    comprobar('el botón siguiente cambia de año', await hasta(`document.querySelector('.epoca-anio')?.textContent !== '${anio}'`, 3000))
    comprobar('sigue plegado en el año nuevo', await hasta("document.querySelector('.epoca-panel') && !document.querySelector('.epoca-panel').open", 3000))
    await evaluar("document.querySelector('.epoca-mandos button[aria-label=\"Recorrer los años\"]').click()")
    comprobar('reproducir llega al presente y frena', await hasta("document.querySelector('.epoca-anio')?.textContent === 'Hoy' && document.querySelector('.epoca-mandos button[aria-label=\"Recorrer los años\"]')", 8000))
  }

  comprobar('una URL rara no rompe nada', await abrir('/?anio=hoy&lente=mundo&viaje=abc&pestania=nada#99/999/999') && !(await evaluar("Boolean(document.querySelector('.fallo'))")))
  comprobar('sin excepciones en la página', excepciones.length === 0, excepciones.slice(0, 3).join(' | '))
  ws.close()
} catch (error) {
  console.log(`FALLA  el recorrido se cortó: ${error.message}`)
  fallas++
} finally {
  chrome.kill()
  await espera(800)
  try { rmSync(perfil, { recursive: true, force: true }) } catch { /* Chrome todavía lo tiene tomado */ }
}

process.exit(fallas ? 1 : 0)
