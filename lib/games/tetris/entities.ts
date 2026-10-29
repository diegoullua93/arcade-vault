import { COLS, COLORS, PIECES, PIECE_TYPES } from "./constants";

export type Piece = {
  type: number;
  shape: number[][];
  x: number;
  y: number;
};

export function randomPiece(): Piece {
  const type = Math.floor(Math.random() * PIECE_TYPES) + 1;
  const shape = PIECES[type].map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

export function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorIndex: number,
  size: number,
  alpha = 1,
) {
  if (!colorIndex) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLORS[colorIndex];
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  ctx.globalAlpha = 1;
}
