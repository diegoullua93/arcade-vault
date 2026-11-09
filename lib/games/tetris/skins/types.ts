// Capa de dibujo de Tetris. Cada skin implementa las mismas funciones; el motor no sabe cuál usa.
// Coordenadas de bloque en celdas (col, fila) y tamaño de celda en px (30 en el tablero y el panel).
export type TetrisSkin = {
  /** Fondo estático del tablero (cacheado en un canvas fuera de pantalla). */
  drawBackground: (ctx: CanvasRenderingContext2D) => void;
  drawBlock: (
    ctx: CanvasRenderingContext2D,
    col: number,
    row: number,
    colorIndex: number,
    size: number,
  ) => void;
  /** Pieza fantasma (destino del hard drop). */
  drawGhost: (
    ctx: CanvasRenderingContext2D,
    col: number,
    row: number,
    colorIndex: number,
    size: number,
  ) => void;
  /** Fondo del canvas de la pieza siguiente (cuadrado de `size` px). */
  drawPreviewBackground: (ctx: CanvasRenderingContext2D, size: number) => void;
  /** PAUSA / GAME OVER. `veil` oscurece el tablero (pausa). */
  drawOverlay: (
    ctx: CanvasRenderingContext2D,
    title: string,
    lines: string[],
    veil: boolean,
  ) => void;
  /** Efectos al limpiar líneas: solo adorno, no afecta a las reglas. */
  onLinesCleared: (rows: number[], points: number) => void;
  updateEffects: (dtMs: number) => void;
  drawEffects: (ctx: CanvasRenderingContext2D) => void;
  resetEffects: () => void;
  /**
   * ¿Hay animación en curso (efectos, destellos)? El motor salta los frames sin cambios; si falta,
   * se asume que sí y se repinta siempre. Tras devolver false el motor repinta un frame más.
   */
  isAnimating?: () => boolean;
};
