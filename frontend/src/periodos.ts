/**
 * Nombres de las épocas que muestra el selector junto al año: "1815 · Era de las revoluciones".
 *
 * Cada período va desde su año hasta el anterior al siguiente, así que no puede haber huecos ni
 * solapamientos. Los años a. C. van en negativo (como en la API). La periodización es la europea
 * escolar; para cambiar un nombre o un corte alcanza con editar esta lista.
 */
export const PERIODOS: { desde: number; nombre: string }[] = [
  { desde: -Infinity, nombre: 'Paleolítico' },
  { desde: -10000, nombre: 'Neolítico' },
  { desde: -3000, nombre: 'Edad del Bronce' },
  { desde: -1200, nombre: 'Edad del Hierro' },
  { desde: -500, nombre: 'Grecia clásica' },
  { desde: -323, nombre: 'Período helenístico' },
  { desde: -30, nombre: 'Imperio romano' },
  { desde: 476, nombre: 'Alta Edad Media' },
  { desde: 1000, nombre: 'Plena Edad Media' },
  { desde: 1300, nombre: 'Baja Edad Media' },
  { desde: 1492, nombre: 'Renacimiento' },
  { desde: 1600, nombre: 'Barroco' },
  { desde: 1700, nombre: 'Ilustración' },
  { desde: 1789, nombre: 'Era de las revoluciones' },
  { desde: 1837, nombre: 'Época victoriana' },
  { desde: 1901, nombre: 'Belle Époque' },
  { desde: 1914, nombre: 'Primera Guerra Mundial' },
  { desde: 1919, nombre: 'Entreguerras' },
  { desde: 1939, nombre: 'Segunda Guerra Mundial' },
  { desde: 1946, nombre: 'Guerra Fría' },
  { desde: 1992, nombre: 'Globalización' },
]

/** El período al que pertenece el año: el último que empieza antes o ese mismo año. */
export function periodoDe(anio: number): string {
  return PERIODOS.findLast((periodo) => periodo.desde <= anio)!.nombre
}
