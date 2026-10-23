import { useRef } from 'react'
import { useBorrarRuta, useImportarRutas, useMarcarTransito } from '../hooks/consultas'
import type { Viaje } from '../types'

const ORIGEN = { gpx: 'GPX', kml: 'KML', dibujada: 'dibujada' } as const

interface Props {
  viaje: Viaje
  dibujando: boolean
  onDibujar: (dibujando: boolean) => void
  onAviso: (aviso: string | null) => void
}

export default function RutasLista({ viaje, dibujando, onDibujar, onAviso }: Props) {
  const importar = useImportarRutas()
  const borrar = useBorrarRuta()
  const marcar = useMarcarTransito()
  const selectorArchivo = useRef<HTMLInputElement>(null)
  const alFallar = (error: Error) => onAviso(error.message)

  const subir = (archivo: File | undefined) => {
    if (!archivo) return
    onAviso(null)
    importar.mutate({ viaje: viaje.id, archivo }, {
      onSuccess: (rutas) => onAviso(`Se importaron ${rutas.length} ${rutas.length === 1 ? 'ruta' : 'rutas'}.`),
      onError: alFallar,
    })
    // Se vacía el input para poder volver a elegir el mismo archivo.
    if (selectorArchivo.current) selectorArchivo.current.value = ''
  }

  const marcarTransito = (id: number) =>
    marcar.mutate(id, {
      onSuccess: ({ agregadas, ya_estaban }) =>
        onAviso(`${agregadas.length} regiones nuevas como tránsito (${ya_estaban} ya estaban en el viaje).`),
      onError: alFallar,
    })

  return (
    <>
      <div className="encabezado-seccion">
        <h3>Rutas</h3>
        <div className="botones">
          <button onClick={() => selectorArchivo.current?.click()} disabled={importar.isPending}>
            {importar.isPending ? 'Importando…' : 'GPX/KML'}
          </button>
          <button className={dibujando ? 'activa' : ''} onClick={() => onDibujar(!dibujando)}>
            {dibujando ? 'Listo' : 'Dibujar'}
          </button>
        </div>
        <input ref={selectorArchivo} type="file" accept=".gpx,.kml" hidden
               onChange={(e) => subir(e.target.files?.[0])} />
      </div>
      {dibujando && (
        <p className="aviso">
          Hacé click en el mapa para ir marcando puntos. Enter (o un click en el último punto) termina la ruta;
          Escape la descarta.
        </p>
      )}

      {viaje.rutas.length ? (
        <ul className="visitas">
          {viaje.rutas.map((ruta) => (
            <li key={ruta.id}>
              <div>
                <strong>{ruta.nombre || 'Ruta'}</strong>{' '}
                <span className="tenue">{ruta.longitud_km.toLocaleString('es-AR')} km · {ORIGEN[ruta.origen]}</span>
              </div>
              <div className="controles">
                <button type="button" onClick={() => marcarTransito(ruta.id)} disabled={marcar.isPending}
                        title="Agrega como tránsito las regiones que atraviesa la ruta">
                  Marcar regiones atravesadas
                </button>
                <button type="button" className="icono" title="Borrar ruta"
                        onClick={() => window.confirm('¿Borrar esta ruta?') && borrar.mutate(ruta.id)}>×</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="vacio">Sin rutas todavía.</p>
      )}
    </>
  )
}
