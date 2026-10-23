import { useRef, useState } from 'react'
import { formatearFecha } from '../etiquetas'
import { useBorrarFoto, useCrearVisita, useSubirFoto } from '../hooks/consultas'
import type { Foto, Viaje } from '../types'

interface Props {
  viaje: Viaje
  fotos: Foto[]
  onAviso: (aviso: string | null) => void
}

export default function FotosLista({ viaje, fotos, onAviso }: Props) {
  const subir = useSubirFoto()
  const borrar = useBorrarFoto()
  const crearVisita = useCrearVisita()
  const selector = useRef<HTMLInputElement>(null)
  const [progreso, setProgreso] = useState<string | null>(null)

  const subirTodas = async (archivos: FileList | null) => {
    if (!archivos?.length) return
    onAviso(null)
    const errores: string[] = []
    let sinGps = 0
    // De a una: cada foto se procesa en el backend (EXIF, miniatura, región).
    for (const [i, archivo] of [...archivos].entries()) {
      setProgreso(`Subiendo ${i + 1}/${archivos.length}…`)
      try {
        const foto = await subir.mutateAsync({ viaje: viaje.id, archivo })
        if (foto.lat === null) sinGps++
      } catch (error) {
        errores.push(`${archivo.name}: ${(error as Error).message}`)
      }
    }
    setProgreso(null)
    if (selector.current) selector.current.value = ''
    const subidas = archivos.length - errores.length
    onAviso([
      `${subidas} ${subidas === 1 ? 'foto subida' : 'fotos subidas'}`
        + (sinGps ? ` (${sinGps} sin GPS: no aparecen en el mapa).` : '.'),
      ...errores,
    ].join(' '))
  }

  const agregarRegion = (foto: Foto) =>
    foto.region && crearVisita.mutate(
      { viaje: viaje.id, region: foto.region, tipo_presencia: 'estadia', realizada: true },
      { onError: (e) => onAviso(e.message) },
    )

  return (
    <>
      <div className="encabezado-seccion">
        <h3>Fotos</h3>
        <button onClick={() => selector.current?.click()} disabled={progreso !== null}>
          {progreso ?? 'Subir'}
        </button>
        <input ref={selector} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
               onChange={(e) => subirTodas(e.target.files)} />
      </div>

      {fotos.length ? (
        <ul className="fotos">
          {fotos.map((foto) => (
            <li key={foto.id}>
              <a href={foto.archivo} target="_blank" rel="noreferrer">
                <img src={foto.miniatura ?? foto.archivo} alt={foto.descripcion || foto.region_nombre || 'Foto'}
                     loading="lazy" />
              </a>
              <div className="foto-pie">
                <span className="tenue">
                  {[foto.region_nombre ?? 'Sin GPS', formatearFecha(foto.tomada_en?.slice(0, 10) ?? null)]
                    .filter(Boolean).join(' · ')}
                </span>
                <button type="button" className="icono" title="Borrar foto"
                        onClick={() => window.confirm('¿Borrar esta foto?') && borrar.mutate(foto.id)}>×</button>
              </div>
              {foto.region_en_viaje === false && (
                <button type="button" className="sugerencia" onClick={() => agregarRegion(foto)}>
                  + Sumar {foto.region_nombre} al viaje
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="vacio">Sin fotos todavía. Las que tengan GPS se ubican solas en el mapa.</p>
      )}
    </>
  )
}
