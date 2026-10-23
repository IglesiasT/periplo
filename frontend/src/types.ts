/** Intensidad con la que se pinta una región visitada (campo `tipo_presencia` de Visita). */
export type TipoPresencia = 'estadia' | 'paso' | 'transito'

/** Estado de una región en el mapa: visitada con cierta intensidad, o en la lista de deseos. */
export type EstadoRegion = TipoPresencia | 'deseo'

/** Respuesta de /api/estados/: código de región → estado. Las regiones sin estado no aparecen. */
export type EstadosRegiones = Record<string, EstadoRegion>

/** Estado de un viaje; refleja el Status de Notion. */
export type EstadoViaje = 'deseo' | 'investigando' | 'en_curso' | 'hecho'

export type NivelRegion = 'pais' | 'provincia' | 'departamento'

export interface Visita {
  id: number
  viaje: number | null
  /** Código de la región: el mismo id que tiene el feature en el GeoJSON. */
  region: string
  region_nombre: string
  region_nivel: NivelRegion
  /** Códigos de las regiones que la contienen, de la más chica a la más grande. */
  region_ancestros: string[]
  tipo_presencia: TipoPresencia
  /** Falso = todavía no fui: se pinta como deseo. */
  realizada: boolean
  /** La creó el sync de Notion: es de solo lectura. */
  desde_notion: boolean
}

export interface Viaje {
  id: number
  nombre: string
  estado: EstadoViaje
  fecha_inicio: string | null
  fecha_fin: string | null
  notion_id: string | null
  notas: string
  visitas: Visita[]
}

/** Campos de un viaje que se pueden mandar a la API. */
export type DatosViaje = Pick<Viaje, 'nombre' | 'estado' | 'fecha_inicio' | 'fecha_fin' | 'notas'>

export type DatosVisita = Pick<Visita, 'viaje' | 'region'> & Partial<Pick<Visita, 'tipo_presencia' | 'realizada'>>
