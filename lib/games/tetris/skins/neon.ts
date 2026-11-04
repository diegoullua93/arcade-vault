import { COLORS, COLS, GRID_LINE, H, ROWS, W } from "../constants";
import type { TetrisSkin } from "./types";

// Aspecto original de Tetris: fondo negro, rejilla tenue y bloques con franja de brillo.
const PIXEL_FONT = "'Press Start 2P', monospace";
const GLOW = "#00f5ff";

function paintBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorIndex: number,
  size: number,
  alpha: number,
) {
  if (!colorIndex) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLORS[colorIndex];
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  ctx.globalAlpha = 1;
}

function paintBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  const block = W / COLS;
  ctx.strokeStyle = GRID_LINE;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * block, 0);
    ctx.lineTo(c * block, H);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * block);
    ctx.lineTo(W, r * block);
    ctx.stroke();
  }
}

export function createNeonSkin(): TetrisSkin {
  let bg: HTMLCanvasElement | null = null;

  return {
    drawBackground(ctx) {
      if (!bg) {
        bg = document.createElement("canvas");
        bg.width = W;
        bg.height = H;
        const bctx = bg.getContext("2d");
        if (bctx) paintBackground(bctx);
      }
      ctx.drawImage(bg, 0, 0);
    },
    drawBlock: (ctx, col, row, colorIndex, size) => paintBlock(ctx, col, row, colorIndex, size, 1),
    drawGhost: (ctx, col, row, colorIndex, size) =>
      paintBlock(ctx, col, row, colorIndex, size, 0.2),
    drawPreviewBackground(ctx, size) {
      ctx.clearRect(0, 0, size, size);
    },
    drawOverlay(ctx, title, lines, veil) {
      if (veil) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, W, H);
      }
      // Banda oscura tras el texto: legible aunque haya piezas debajo (GAME OVER no lleva velo)
      const bandTop = H / 2 - 52;
      const bandH = 52 + 18 + lines.length * 22 + 14;
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.fillRect(0, bandTop, W, bandH);
      ctx.fillStyle = "rgba(0,245,255,0.45)";
      ctx.fillRect(0, bandTop, W, 1);
      ctx.fillRect(0, bandTop + bandH - 1, W, 1);

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `24px ${PIXEL_FONT}`;
      ctx.fillStyle = "#fff";
      ctx.shadowColor = GLOW;
      ctx.shadowBlur = 14;
      ctx.fillText(title, W / 2, H / 2 - 22);
      ctx.shadowBlur = 0;
      ctx.font = `9px ${PIXEL_FONT}`;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      lines.forEach((line, i) => ctx.fillText(line, W / 2, H / 2 + 18 + i * 22));
      ctx.restore();
    },
    onLinesCleared() {},
    updateEffects() {},
    drawEffects() {},
    resetEffects() {},
  };
}
