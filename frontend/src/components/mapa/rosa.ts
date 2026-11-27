/** El dibujo de la rosa, en un cuadro de 86 centrado en 0: lo comparten el botón y la imagen exportada. */
export const ROSA = {
  lado: 86,
  circulos: [{ r: 28, trazo: 0.8 }, { r: 24, trazo: 0.5 }],
  /** Norte-sur, en tinta. */
  meridiano: 'M0 -32L4.5 0L0 32L-4.5 0Z',
  /** Este-oeste, en papel con borde de tinta. */
  paralelo: 'M-32 0L0 -4.5L32 0L0 4.5Z',
  /** Media punta norte, con el color de lo visitado. */
  norte: 'M0 -32L4.5 0L0 0Z',
  letra: { y: -35, tam: 11 },
}
