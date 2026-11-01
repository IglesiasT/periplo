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

/** Respuesta de /api/estadisticas/. */
export interface Estadisticas {
  paises_visitados: number
  paises_total: number
  provincias_argentinas_visitadas: number
  provincias_argentinas_total: number
  /** Sin contar las islas en mar abierto, que Natural Earth agrupa como un continente más. */
  continentes_visitados: number
  continentes_total: number
  /** Entidades distintas pisadas en algún año, con la misma regla que el panel de la época. */
  entidades_historicas_pisadas: number
  continentes: { continente: string; visitados: number; total: number }[]
  /** De los que más provincias tienen recorridas (en proporción) a los que menos. */
  paises: {
    codigo: string
    nombre: string
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

/** Texto en markdown escrito a mano sobre una región. */
export interface Ficha {
  texto: string
  actualizada: string
}

/** Respuesta de /api/regiones/<codigo>/: todo lo de una región para su ficha. */
export interface RegionDetalle {
  codigo: string
  nombre: string
  nivel: NivelRegion
  /** De la más chica a la más grande: provincia, país. */
  ancestros: { codigo: string; nombre: string }[]
  ficha: Ficha | null
  /** Visitas a la región o a algo que está adentro (sus departamentos). */
  visitas: {
    id: number
    viaje: number | null
    viaje_nombre: string | null
    viaje_inicio: string | null
    region: string
    region_nombre: string
    tipo_presencia: TipoPresencia
    realizada: boolean
  }[]
  /** Entidad principal en cada tramo de snapshots consecutivos. `nombre` ya viene en castellano si está traducido. */
  historia: { desde: number; hasta: number; entidad: string; nombre: string }[]
}

/** Un elemento de /api/fichas/. */
export interface FichaResumen {
  codigo: string
  nombre: string
  actualizada: string
}

/** Respuesta de /api/historia/<anio>/: el mapa en un año histórico. */
export interface Epoca {
  /** Los a. C. van en negativo. */
  anio: number
  /** Código de región → entidad que ocupaba la mayor parte. Las regiones sin entidad no aparecen. */
  regiones: Record<string, string>
  /** Solo las entidades con color propio; el resto toma la aguada de su tono. */
  colores: Record<string, string>
  /** Nombre en castellano, solo de las entidades traducidas. Las claves de todo lo demás son el nombre original. */
  nombres: Record<string, string>
  /** Entidades cuyo territorio pisé en alguna visita realizada, de la que más regiones tiene a la que menos. */
  pisadas: { entidad: string; regiones: { codigo: string; nombre: string }[] }[]
  /** Dónde va el nombre de cada entidad del año en el mapa, de la más grande a la más chica. */
  rotulos: { entidad: string; lon: number; lat: number; area_km2: number }[]
  /** Qué aguada del tema le toca a cada entidad: distinta de la de sus vecinas (lo calcula el backend). */
  tonos: Record<string, number>
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
