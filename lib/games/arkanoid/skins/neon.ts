import {
  BALL_SIZE,
  BLOCK_H,
  BLOCK_W,
  H,
  PADDLE_H,
  PADDLE_W,
  W,
  type BlockColor,
} from "../constants";
import type { ArkanoidSkin } from "./types";

// Tubos de neón sobre la oscuridad del tema: cada bloque es un contorno luminoso con relleno
// translúcido, la pelota deja estela y al romperse un bloque salta una lluvia de chispas aditivas.
// Los brillos (shadowBlur) se hornean una vez en sprites fuera de pantalla, nunca por frame.

const PIXEL_FONT = "'Press Start 2P', monospace";
const BG = "#0a0a0f";
const CYAN = "#00f5ff";
const MAGENTA = "#ff006e";
const INK = "#e6e9ff";

const NEON: Record<BlockColor, string> = {
  red: "#ff3b4f",
  yellow: "#f5ff00",
  cyan: "#00f5ff",
  magenta: "#b44dff",
  hotpink: "#ff006e",
  green: "#00ff88",
  gray: "#a8b0d8",
};

const GLOW_PAD = 14; // margen de los sprites para que el halo no se recorte
const SPARK_MS = 420;
const TRAIL_LEN = 7;

type Sprite = { canvas: HTMLCanvasElement; pad: number };

function makeSprite(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = w + GLOW_PAD * 2;
  canvas.height = h + GLOW_PAD * 2;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.translate(GLOW_PAD, GLOW_PAD);
    paint(ctx);
  }
  return { canvas, pad: GLOW_PAD };
}

function paintBlock(ctx: CanvasRenderingContext2D, color: string) {
  const x = 4;
  const y = 4;
  const w = BLOCK_W - 8;
  const h = BLOCK_H - 8;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.stroke();
  ctx.stroke(); // segunda pasada: halo más denso
  ctx.shadowBlur = 0;
  // Filamento interior blanco: el "tubo" encendido
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 4);
  ctx.lineTo(x + w - 6, y + 4);
  ctx.stroke();
}

function paintPaddle(ctx: CanvasRenderingContext2D) {
  const w = PADDLE_W;
  const h = PADDLE_H;
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 16;
  ctx.fillStyle = "rgba(0,245,255,0.22)";
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(1, 1, w - 2, h - 2, h / 2);
  ctx.fill();
  ctx.stroke();
  // Casquillos magenta en los extremos
  ctx.shadowColor = MAGENTA;
  ctx.fillStyle = MAGENTA;
  ctx.beginPath();
  ctx.roundRect(1, 1, 14, h - 2, [h / 2, 2, 2, h / 2]);
  ctx.roundRect(w - 15, 1, 14, h - 2, [2, h / 2, h / 2, 2]);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(18, h / 2 - 1, w - 36, 2);
}

function paintBall(ctx: CanvasRenderingContext2D) {
  const r = BALL_SIZE / 2;
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(r, r, r - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fill();
}

function paintBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Rejilla tenue
  ctx.strokeStyle = "rgba(0,245,255,0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 40; x < W; x += 40) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
  }
  for (let y = 40; y < H; y += 40) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
  }
  ctx.stroke();

  // Viñeta: concentra la luz en el centro de la pista
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  // Paredes de rebote encendidas (cian) y línea de foso (magenta discontinua)
  ctx.shadowBlur = 10;
  ctx.shadowColor = CYAN;
  ctx.fillStyle = CYAN;
  ctx.fillRect(0, 0, W, 2);
  ctx.fillRect(0, 0, 2, H);
  ctx.fillRect(W - 2, 0, 2, H);
  ctx.shadowColor = MAGENTA;
  ctx.strokeStyle = MAGENTA;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(0, H - 3);
  ctx.lineTo(W, H - 3);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

type Spark = { x: number; y: number; vx: number; vy: number; color: string };
type Burst = { sparks: Spark[]; elapsed: number };

export function createNeonSkin(): ArkanoidSkin {
  let bg: HTMLCanvasElement | null = null;
  const blocks = new Map<BlockColor, Sprite>();
  let paddle: Sprite | null = null;
  let ball: Sprite | null = null;
  let bursts: Burst[] = [];
  const trail: { x: number; y: number }[] = [];

  const blockSprite = (color: BlockColor) => {
    let s = blocks.get(color);
    if (!s) {
      s = makeSprite(BLOCK_W, BLOCK_H, (c) => paintBlock(c, NEON[color]));
      blocks.set(color, s);
    }
    return s;
  };

  return {
    load(onReady) {
      onReady();
      return () => {};
    },
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
    drawBlock(ctx, b) {
      const s = blockSprite(b.color);
      ctx.drawImage(s.canvas, b.x - s.pad, b.y - s.pad);
    },
    drawExplosion(ctx, exp, t) {
      // El tubo se hincha y se apaga
      const s = blockSprite(exp.color);
      const k = 1 + 0.35 * t;
      const cx = exp.x + exp.w / 2;
      const cy = exp.y + exp.h / 2;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 1 - t;
      ctx.translate(cx, cy);
      ctx.scale(k, k);
      ctx.drawImage(s.canvas, -s.canvas.width / 2, -s.canvas.height / 2);
      ctx.restore();
    },
    drawPaddle(ctx, p) {
      if (!paddle) paddle = makeSprite(PADDLE_W, PADDLE_H, paintPaddle);
      ctx.drawImage(paddle.canvas, p.x - paddle.pad, p.y - paddle.pad);
    },
    drawBall(ctx, b) {
      if (!ball) ball = makeSprite(BALL_SIZE, BALL_SIZE, paintBall);
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const last = trail[trail.length - 1];
      // Saque o vida perdida: la estela no cruza la pantalla
      if (last && Math.hypot(last.x - cx, last.y - cy) > 60) trail.length = 0;
      if (!last || last.x !== cx || last.y !== cy) trail.push({ x: cx, y: cy });
      if (trail.length > TRAIL_LEN) trail.shift();

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = CYAN;
      for (let i = 0; i < trail.length - 1; i++) {
        const a = (i + 1) / trail.length;
        ctx.globalAlpha = a * 0.35;
        ctx.beginPath();
        ctx.arc(trail[i].x, trail[i].y, (b.w / 2) * a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.drawImage(ball.canvas, b.x - ball.pad, b.y - ball.pad);
    },
    drawOverlay(ctx, title, lines) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, 0, W, H);
      const bandTop = H / 2 - 70;
      const bandH = 70 + 26 + lines.length * 30 + 20;
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.fillRect(0, bandTop, W, bandH);
      ctx.fillStyle = "rgba(0,245,255,0.45)";
      ctx.fillRect(0, bandTop, W, 1);
      ctx.fillRect(0, bandTop + bandH - 1, W, 1);

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let size = 36;
      ctx.font = `${size}px ${PIXEL_FONT}`;
      while (size > 16 && ctx.measureText(title).width > W - 80) {
        size -= 2;
        ctx.font = `${size}px ${PIXEL_FONT}`;
      }
      ctx.fillStyle = "#fff";
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = 18;
      ctx.fillText(title, W / 2, H / 2 - 30);
      ctx.shadowBlur = 0;
      ctx.font = `12px ${PIXEL_FONT}`;
      lines.forEach((line, i) => {
        ctx.fillStyle = i === 0 && lines.length > 1 ? NEON.yellow : "rgba(230,233,255,0.75)";
        ctx.fillText(line, W / 2, H / 2 + 22 + i * 30);
      });
      ctx.restore();
    },
    onBlockHit(b) {
      const color = NEON[b.color];
      const sparks: Spark[] = [];
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 0.08 + Math.random() * 0.2;
        sparks.push({
          x: b.x + b.w / 2 + (Math.random() - 0.5) * b.w * 0.6,
          y: b.y + b.h / 2,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          color: i % 4 === 0 ? INK : color,
        });
      }
      bursts.push({ sparks, elapsed: 0 });
    },
    updateEffects(dtMs) {
      if (!bursts.length) return;
      for (const b of bursts) b.elapsed += dtMs;
      bursts = bursts.filter((b) => b.elapsed < SPARK_MS);
    },
    drawEffects(ctx) {
      if (!bursts.length) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const b of bursts) {
        const t = b.elapsed / SPARK_MS;
        ctx.globalAlpha = 1 - t;
        for (const s of b.sparks) {
          ctx.fillStyle = s.color;
          const x = s.x + s.vx * b.elapsed;
          const y = s.y + s.vy * b.elapsed;
          ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
      }
      ctx.restore();
    },
    resetEffects() {
      bursts = [];
      trail.length = 0;
    },
  };
}
