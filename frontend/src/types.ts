/** Intensidad con la que se pinta una región visitada (campo `tipo_presencia` de Visita). */
export type TipoPresencia = 'estadia' | 'paso' | 'transito'

export interface Visita {
  /** Código ISO 3166-2 de la región, ej. "AR-A". Es el id del feature en el GeoJSON. */
  codigo: string
  nombre: string
  tipo_presencia: TipoPresencia
}
