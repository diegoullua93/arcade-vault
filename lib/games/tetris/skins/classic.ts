import { COLS, H, ROWS, W } from "../constants";
import { bitmapText } from "../../bitmap-font";
import type { TetrisSkin } from "./types";

// Arcade de los 80: fondo negro liso, paleta plana de consola de 8 bits y bloques dibujados como
// sprites de 10×10 "píxeles" gruesos (1 píxel = size / 10). Sin brillos, sin degradados.

// [color base, sombra plana] por tipo de pieza: 1 I, 2 O, 3 T, 4 S, 5 Z, 6 J, 7 L, 8 N
const PALETTE: readonly (readonly [string, string])[] = [
  ["", ""],
  ["#00e8d8", "#008888"],
  ["#fcd800", "#ac7c00"],
  ["#d800cc", "#800080"],
  ["#00b800", "#005800"],
  ["#f83800", "#a81000"],
  ["#2058f8", "#0020a0"],
  ["#fca044", "#c84c0c"],
  ["#bcbcbc", "#747474"],
];
const WHITE = "#fcfcfc";
const BLACK = "#000000";
const GRID_DOT = "#24246c";
const ACCENT = "#f83800";

const FLASH_MS = 180;

function paintSprite(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  colorIndex: number,
  size: number,
) {
  const [base, shade] = PALETTE[colorIndex] ?? PALETTE[8];
  const p = size / 10;
  const x = col * size;
  const y = row * size;
  // Cuerpo de 9×9 píxeles: la columna y fila 10 quedan negras como separación
  ctx.fillStyle = base;
  ctx.fillRect(x, y, 9 * p, 9 * p);
  ctx.fillStyle = shade;
  ctx.fillRect(x, y + 8 * p, 9 * p, p);
  ctx.fillRect(x + 8 * p, y, p, 9 * p);
  // Brillo en "L" de 3 píxeles
  ctx.fillStyle = WHITE;
  ctx.fillRect(x + p, y + p, p, p);
  ctx.fillRect(x + 2 * p, y + p, p, p);
  ctx.fillRect(x + p, y + 2 * p, p, p);
}

function paintGhost(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  colorIndex: number,
  size: number,
) {
  const [base] = PALETTE[colorIndex] ?? PALETTE[8];
  const p = size / 10;
  const x = col * size;
  const y = row * size;
  ctx.fillStyle = base;
  // Contorno punteado: un píxel sí, uno no
  for (let i = 0; i < 9; i += 2) {
    ctx.fillRect(x + i * p, y, p, p);
    ctx.fillRect(x + i * p, y + 8 * p, p, p);
    ctx.fillRect(x, y + i * p, p, p);
    ctx.fillRect(x + 8 * p, y + i * p, p, p);
  }
}

function paintBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BLACK;
  ctx.fillRect(0, 0, W, H);
  const block = W / COLS;
  const p = block / 10;
  ctx.fillStyle = GRID_DOT;
  for (let r = 1; r < ROWS; r++)
    for (let c = 1; c < COLS; c++) ctx.fillRect(c * block - p, r * block - p, p, p);
}

// Tramado de damero de 3 px: oscurece el tablero en pausa sin transparencias
function paintDither(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BLACK;
  for (let y = 0; y < H; y += 3)
    for (let x = (y / 3) % 2 === 0 ? 0 : 3; x < W; x += 6) ctx.fillRect(x, y, 3, 3);
}

export function createClassicSkin(): TetrisSkin {
  let bg: HTMLCanvasElement | null = null;
  let dither: HTMLCanvasElement | null = null;
  let flashes: { rows: number[]; elapsed: number }[] = [];

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
    drawBlock(ctx, col, row, colorIndex, size) {
      if (colorIndex) paintSprite(ctx, col, row, colorIndex, size);
    },
    drawGhost(ctx, col, row, colorIndex, size) {
      if (colorIndex) paintGhost(ctx, col, row, colorIndex, size);
    },
    drawPreviewBackground(ctx, size) {
      ctx.fillStyle = BLACK;
      ctx.fillRect(0, 0, size, size);
    },
    drawOverlay(ctx, title, lines, veil) {
      if (veil) {
        if (!dither) {
          dither = document.createElement("canvas");
          dither.width = W;
          dither.height = H;
          const dctx = dither.getContext("2d");
          if (dctx) paintDither(dctx);
        }
        ctx.drawImage(dither, 0, 0);
      }
      const boxW = 252;
      const boxH = 84 + lines.length * 26;
      const bx = Math.round((W - boxW) / 2 / 3) * 3;
      const by = Math.round((H - boxH) / 2 / 3) * 3;
      ctx.fillStyle = WHITE;
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.fillStyle = BLACK;
      ctx.fillRect(bx + 3, by + 3, boxW - 6, boxH - 6);
      ctx.fillStyle = ACCENT;
      ctx.fillRect(bx + 9, by + 9, boxW - 18, 3);
      ctx.fillRect(bx + 9, by + boxH - 12, boxW - 18, 3);

      const inner = boxW - 30;
      bitmapText(ctx, title, W / 2, by + 39, inner, 6, WHITE);
      lines.forEach((line, i) =>
        bitmapText(ctx, line, W / 2, by + 75 + i * 24, inner, 3, i === 0 ? PALETTE[2][0] : WHITE),
      );
    },
    onLinesCleared(rows) {
      flashes.push({ rows, elapsed: 0 });
    },
    updateEffects(dtMs) {
      if (!flashes.length) return;
      for (const f of flashes) f.elapsed += dtMs;
      flashes = flashes.filter((f) => f.elapsed < FLASH_MS);
    },
    drawEffects(ctx) {
      const block = W / COLS;
      for (const f of flashes) {
        // Dos parpadeos de barra blanca plana
        if (Math.floor(f.elapsed / (FLASH_MS / 4)) % 2 === 1) continue;
        ctx.fillStyle = WHITE;
        for (const r of f.rows) ctx.fillRect(0, r * block, W, block - block / 10);
      }
    },
    resetEffects() {
      flashes = [];
    },
  };
}
