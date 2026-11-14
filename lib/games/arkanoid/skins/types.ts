import type { Ball, Block, Explosion, Paddle } from "../entities";

// Capa de dibujo de Arkanoid. Cada skin implementa las mismas funciones; el motor no sabe cuál usa.
// Las entidades llegan con sus hitboxes reales: el skin puede adornar, pero no cambia medidas.
export type ArkanoidSkin = {
  /**
   * Prepara los assets del skin y llama a `onReady` cuando ya puede dibujar (síncrono si no hay
   * assets). Devuelve una función que aborta la carga si el motor se destruye antes.
   */
  load: (onReady: () => void) => () => void;
  /** Fondo estático (cacheado en un canvas fuera de pantalla). */
  drawBackground: (ctx: CanvasRenderingContext2D) => void;
  drawBlock: (ctx: CanvasRenderingContext2D, block: Block) => void;
  /** Explosión de un bloque; `t` va de 0 a 1 durante EXPLOSION_DURATION. */
  drawExplosion: (ctx: CanvasRenderingContext2D, exp: Explosion, t: number) => void;
  drawPaddle: (ctx: CanvasRenderingContext2D, paddle: Paddle) => void;
  drawBall: (ctx: CanvasRenderingContext2D, ball: Ball) => void;
  /** PAUSA / GAME OVER / victoria, con velo sobre la escena. */
  drawOverlay: (ctx: CanvasRenderingContext2D, title: string, lines: string[]) => void;
  /** Efectos al romper un bloque: solo adorno, no afecta a las reglas. */
  onBlockHit: (block: Block, points: number) => void;
  updateEffects: (dtMs: number) => void;
  drawEffects: (ctx: CanvasRenderingContext2D) => void;
  resetEffects: () => void;
};
