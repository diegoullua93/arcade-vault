import { bitmapText } from "../../bitmap-font";
import { H, W, type BlockColor } from "../constants";
import type { ArkanoidSkin } from "./types";

// Aspecto original de Arkanoid: spritesheet pixel-art sobre fondo negro liso. Los textos usan la
// fuente bitmap 3×5 y la pausa oscurece con tramado de damero, sin transparencias.

const SPRITESHEET_URL = "/games/arkanoid/spritesheet-breakout.png";

type SpriteRect = { sx: number; sy: number; sw: number; sh: number };

const SPRITES = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  } satisfies Record<BlockColor, SpriteRect>,
};

const explosionRow = (sy: number): SpriteRect[] =>
  [256, 288, 320, 352].map((sx) => ({ sx, sy, sw: 32, sh: 16 }));

const EXPLOSION_FRAMES: Record<BlockColor, SpriteRect[]> = {
  red: explosionRow(176),
  cyan: explosionRow(192),
  green: explosionRow(208),
  magenta: explosionRow(224),
  yellow: explosionRow(240),
  hotpink: explosionRow(256),
  gray: explosionRow(176),
};

const WHITE = "#fcfcfc";
const BLACK = "#000000";
const ACCENT = "#f83800";
const SCORE_YELLOW = "#fcd800";

// Tramado de damero de 3 px: oscurece la escena sin transparencias
function paintDither(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BLACK;
  for (let y = 0; y < H; y += 3)
    for (let x = (y / 3) % 2 === 0 ? 0 : 3; x < W; x += 6) ctx.fillRect(x, y, 3, 3);
}

export function createClassicSkin(): ArkanoidSkin {
  let sprites: HTMLImageElement | null = null;
  let dither: HTMLCanvasElement | null = null;

  const blit = (
    ctx: CanvasRenderingContext2D,
    f: SpriteRect,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    if (sprites) ctx.drawImage(sprites, f.sx, f.sy, f.sw, f.sh, x, y, w, h);
  };

  return {
    load(onReady) {
      const img = new Image();
      img.onload = () => {
        sprites = img;
        onReady();
      };
      img.onerror = () => console.error("No se pudo cargar el spritesheet de Arkanoid");
      img.src = SPRITESHEET_URL;
      return () => {
        img.onload = null;
        img.onerror = null;
      };
    },
    drawBackground(ctx) {
      ctx.fillStyle = BLACK;
      ctx.fillRect(0, 0, W, H);
    },
    drawBlock(ctx, b) {
      blit(ctx, SPRITES.blocks[b.color], b.x, b.y, b.w, b.h);
    },
    drawExplosion(ctx, exp, t) {
      const frames = EXPLOSION_FRAMES[exp.color];
      const i = Math.min(Math.floor(t * frames.length), frames.length - 1);
      blit(ctx, frames[i], exp.x, exp.y, exp.w, exp.h);
    },
    drawPaddle(ctx, p) {
      blit(ctx, SPRITES.paddle, p.x, p.y, p.w, p.h);
    },
    drawBall(ctx, b) {
      blit(ctx, SPRITES.ball, b.x, b.y, b.w, b.h);
    },
    drawOverlay(ctx, title, lines) {
      if (!dither) {
        dither = document.createElement("canvas");
        dither.width = W;
        dither.height = H;
        const dctx = dither.getContext("2d");
        if (dctx) paintDither(dctx);
      }
      ctx.drawImage(dither, 0, 0);

      const boxW = 492;
      const boxH = 120 + lines.length * 30;
      const bx = Math.round((W - boxW) / 2 / 3) * 3;
      const by = Math.round((H - boxH) / 2 / 3) * 3;
      ctx.fillStyle = WHITE;
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.fillStyle = BLACK;
      ctx.fillRect(bx + 4, by + 4, boxW - 8, boxH - 8);
      ctx.fillStyle = ACCENT;
      ctx.fillRect(bx + 12, by + 12, boxW - 24, 4);
      ctx.fillRect(bx + 12, by + boxH - 16, boxW - 24, 4);

      const inner = boxW - 48;
      bitmapText(ctx, title, W / 2, by + 54, inner, 8, WHITE);
      lines.forEach((line, i) =>
        bitmapText(ctx, line, W / 2, by + 104 + i * 30, inner, 4, i === 0 ? SCORE_YELLOW : WHITE),
      );
    },
    onBlockHit() {},
    updateEffects() {},
    drawEffects() {},
    resetEffects() {},
  };
}
