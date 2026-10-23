/** Intensidad con la que se pinta una región visitada (campo `tipo_presencia` de Visita). */
export type TipoPresencia = 'estadia' | 'paso' | 'transito'

/** Estado de una región en el mapa: visitada con cierta intensidad, o en la lista de deseos. */
export type EstadoRegion = TipoPresencia | 'deseo'

/** Respuesta de /api/estados/: código de región → estado. Las regiones sin estado no aparecen. */
export type EstadosRegiones = Record<string, EstadoRegion>
