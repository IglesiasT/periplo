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
  rutas: RutaResumen[]
}

export type OrigenRuta = 'gpx' | 'kml' | 'dibujada'

export interface RutaResumen {
  id: number
  nombre: string
  longitud_km: number
  origen: OrigenRuta
}

export interface Ruta extends RutaResumen {
  viaje: number
  /** LineString: lista de [lon, lat], el mismo orden que GeoJSON. */
  coordenadas: [number, number][]
}

/** Campos de un viaje que se pueden mandar a la API. */
export type DatosViaje = Pick<Viaje, 'nombre' | 'estado' | 'fecha_inicio' | 'fecha_fin' | 'notas'>

export type DatosVisita = Pick<Visita, 'viaje' | 'region'> & Partial<Pick<Visita, 'tipo_presencia' | 'realizada'>>

/** Respuesta de /api/estadisticas/. */
export interface Estadisticas {
  km2_visitados: number
  porcentaje_mundo: number
  paises_visitados: number
  paises_total: number
  viajes_hechos: number
  km_rutas: number
  continentes: { continente: string; visitados: number; total: number }[]
  paises: {
    codigo: string
    nombre: string
    km2_visitados: number
    porcentaje: number
    provincias_visitadas: number
    provincias_total: number
  }[]
}

/** Un logro de /api/logros/: se completa cumpliendo todos sus objetivos. */
export interface Logro {
  id: string
  nombre: string
  descripcion: string
  cumplidos: number
  total: number
  completo: boolean
  objetivos: {
    nombre: string
    /** Se cumple con una visita realizada a cualquiera de estas regiones (o a algo que esté adentro). */
    regiones: string[]
    cumplido: boolean
  }[]
}

/** Respuesta de /api/historia/<anio>/: el mapa en un año histórico. */
export interface Epoca {
  /** Los a. C. van en negativo. */
  anio: number
  /** Código de región → entidad que ocupaba la mayor parte. Las regiones sin entidad no aparecen. */
  regiones: Record<string, string>
  /** Solo las entidades con color propio; el resto se colorea por su nombre. */
  colores: Record<string, string>
  /** Nombre en castellano, solo de las entidades traducidas. Las claves de todo lo demás son el nombre original. */
  nombres: Record<string, string>
  /** Entidades cuyo territorio pisé en alguna visita realizada, de la que más regiones tiene a la que menos. */
  pisadas: { entidad: string; regiones: { codigo: string; nombre: string }[] }[]
}

export interface Foto {
  id: number
  viaje: number | null
  visita: number | null
  /** URLs relativas (/media/...): las sirve Django a través del proxy de Vite. */
  archivo: string
  miniatura: string | null
  lat: number | null
  lon: number | null
  tomada_en: string | null
  /** Región donde se sacó (si tenía GPS) y si el viaje ya la tiene. */
  region: string | null
  region_nombre: string | null
  region_en_viaje: boolean | null
  descripcion: string
}
