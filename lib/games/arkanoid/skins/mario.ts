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

// Plataformero colorido, con la paleta y las técnicas de Serpentina (lib/games/serpentina):
// cielo en degradado, nubes, colinas y agua al fondo cacheados; bloques con bisel y remaches;
// la paleta es una plataforma de hierba flotante; al romper un bloque saltan sus pedazos, una
// moneda con "+10" y estrellas. Cartel crema para PAUSA / GAME OVER.

const FONT_FAMILY = "'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif";

const C = {
  skyTop: "#4a90f0",
  skyBottom: "#bfe3ff",
  cloud: "#ffffff",
  cloudShadow: "#bcd6f2",
  hillMint: "#a6dcae",
  hillPink: "#f4b0c6",
  hillYellow: "#f6e08a",
  grass: "#5dbb3a",
  grassDark: "#3e8e2b",
  soil: "#e49b3c",
  soilWave: "#c97b22",
  water: "#2f78d8",
  waterLight: "#8cc8ff",
  checker: "rgba(255, 255, 255, 0.08)",
  outline: "#4a2a10",
  coin: "#ffd21f",
  coinInner: "#ffe97a",
  coinOutline: "#a86d0a",
  star: "#fff04d",
  veil: "rgba(18, 46, 105, 0.55)",
  panel: "#fff4d6",
  panelText: "#6b3410",
} as const;

// [base, luz, sombra] por color de bloque; el gris es ladrillo
const BLOCKS: Record<BlockColor, readonly [string, string, string]> = {
  red: ["#f0533c", "#ff9c8a", "#a8281a"],
  yellow: ["#ffd21f", "#ffe97a", "#c98a0a"],
  cyan: ["#36c5f0", "#9be6ff", "#1a7fb0"],
  magenta: ["#b45cf0", "#dcaaff", "#7430b0"],
  hotpink: ["#ff7eb6", "#ffc0dc", "#c0407a"],
  green: ["#5dbb3a", "#a4e47e", "#3e8e2b"],
  gray: ["#c8743c", "#e8a878", "#8a4a1e"],
};

const WATER_H = 14; // franja de agua: por ahí se pierde la pelota
const FRAGMENT_MS = 650;
const POPUP_MS = 700;
const STARS_MS = 380;
const GRAVITY = 0.0016; // px/ms²
const PANEL_W = 560;

// [dx, dy, radio] de los bultos de una nube de ~100 px de ancho (como Serpentina)
const CLOUD_PUFFS = [
  [0, 0, 20],
  [24, -12, 26],
  [54, -8, 24],
  [78, 2, 18],
] as const;

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const pass = (color: string, offsetY: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const [dx, dy, r] of CLOUD_PUFFS) {
      ctx.moveTo(x + (dx + r) * scale, y + (dy + offsetY) * scale);
      ctx.arc(x + dx * scale, y + (dy + offsetY) * scale, r * scale, 0, Math.PI * 2);
    }
    ctx.roundRect(x - 20 * scale, y + (-2 + offsetY) * scale, 118 * scale, 22 * scale, 11 * scale);
    ctx.fill();
  };
  pass(C.cloudShadow, 5);
  pass(C.cloud, 0);
}

function drawHill(ctx: CanvasRenderingContext2D, x: number, rx: number, ry: number, color: string) {
  const base = H - WATER_H;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, base, rx, ry, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.28, base, rx * 0.34, ry * 0.8, 0, Math.PI, Math.PI * 2);
  ctx.fill();
}

function paintBackground(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, C.skyTop);
  sky.addColorStop(1, C.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Nubes en el cielo libre entre los bloques y la paleta
  drawCloud(ctx, 70, 300, 1.1);
  drawCloud(ctx, 560, 270, 1.3);
  drawCloud(ctx, 330, 380, 0.8);
  drawCloud(ctx, 690, 40, 0.7);
  drawCloud(ctx, 30, 30, 0.6);

  drawHill(ctx, 110, 130, 120, C.hillMint);
  drawHill(ctx, 380, 120, 150, C.hillPink);
  drawHill(ctx, 640, 150, 110, C.hillYellow);
  drawHill(ctx, 250, 90, 60, C.hillYellow);
  drawHill(ctx, 520, 90, 50, C.hillMint);
  drawHill(ctx, 770, 80, 70, C.hillPink);

  ctx.fillStyle = C.checker;
  for (let y = 0; y < H - WATER_H; y += 40)
    for (let x = (y / 40) % 2 === 0 ? 0 : 40; x < W; x += 80) ctx.fillRect(x, y, 40, 40);

  // Agua con crestas al fondo
  const top = H - WATER_H;
  ctx.fillStyle = C.water;
  ctx.fillRect(0, top, W, WATER_H);
  ctx.fillStyle = C.waterLight;
  ctx.beginPath();
  for (let x = 0; x < W; x += 20) {
    ctx.moveTo(x + 20, top + 2);
    ctx.arc(x + 10, top + 2, 10, 0, Math.PI, true);
  }
  ctx.fill();
  ctx.fillStyle = C.water;
  ctx.beginPath();
  for (let x = 0; x < W; x += 20) {
    ctx.moveTo(x + 20, top + 6);
    ctx.arc(x + 10, top + 6, 10, 0, Math.PI, true);
  }
  ctx.fill();
}

function paintBlock(ctx: CanvasRenderingContext2D, color: BlockColor) {
  const [base, light, dark] = BLOCKS[color];
  const w = BLOCK_W;
  const h = BLOCK_H;
  const b = 3; // grosor del bisel

  ctx.fillStyle = C.outline;
  ctx.beginPath();
  ctx.roundRect(1, 1, w - 2, h - 2, 5);
  ctx.fill();
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.roundRect(3, 3, w - 6, h - 6, 3);
  ctx.fill();

  ctx.fillStyle = light;
  ctx.fillRect(5, 4, w - 10, b);
  ctx.fillRect(4, 5, b, h - 10);
  ctx.fillStyle = dark;
  ctx.fillRect(5, h - 4 - b, w - 10, b);
  ctx.fillRect(w - 4 - b, 5, b, h - 10);

  ctx.fillStyle = dark;
  if (color === "gray") {
    // Juntas de ladrillo
    const mid = h / 2 - 1;
    ctx.fillRect(4, mid, w - 8, 2);
    ctx.fillRect(w / 2 - 1, 4, 2, mid - 4);
    ctx.fillRect(w / 4, mid + 2, 2, h - mid - 6);
    ctx.fillRect((w * 3) / 4, mid + 2, 2, h - mid - 6);
  } else {
    // Remaches
    for (const rx of [9, w - 12]) for (const ry of [8, h - 11]) ctx.fillRect(rx, ry, 3, 3);
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.beginPath();
  ctx.ellipse(w * 0.22, h * 0.34, 6, 2.5, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

// Plataforma flotante: hierba arriba, tierra con ondas abajo
function paintPaddle(ctx: CanvasRenderingContext2D) {
  const w = PADDLE_W;
  const h = PADDLE_H;
  ctx.fillStyle = C.outline;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 6);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(2, 2, w - 4, h - 4, 4);
  ctx.clip();
  ctx.fillStyle = C.soil;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = C.soilWave;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 2; x < w; x += 10) {
    ctx.moveTo(x, h - 3);
    ctx.arc(x + 5, h - 3, 4, Math.PI, 0);
  }
  ctx.stroke();
  ctx.fillStyle = C.grass;
  ctx.fillRect(0, 0, w, 6);
  ctx.beginPath();
  for (let x = 0; x < w; x += 8) {
    ctx.moveTo(x + 8, 6);
    ctx.arc(x + 4, 6, 4, 0, Math.PI);
  }
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(4, 2, w - 8, 2);
  ctx.restore();
}

function paintBall(ctx: CanvasRenderingContext2D) {
  const r = BALL_SIZE / 2;
  ctx.fillStyle = C.outline;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(r, r, r - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d8e6f8";
  ctx.beginPath();
  ctx.arc(r + 1, r + 1.5, r - 4, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(r - 2, r - 2.5, 2.5, 1.6, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = C.star;
  ctx.fill();
  ctx.strokeStyle = C.panelText;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawCoin(ctx: CanvasRenderingContext2D, cx: number, cy: number, squash: number) {
  const rx = 8 * squash;
  ctx.fillStyle = C.coinOutline;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 2, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.coin;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.coinInner;
  ctx.fillRect(cx - Math.max(1, rx * 0.25), cy - 4, Math.max(2, rx * 0.5), 8);
}

type Fragment = { sx: number; sy: number; x: number; y: number; vx: number; vy: number };
type Burst = {
  color: BlockColor;
  cx: number;
  cy: number;
  fragments: Fragment[];
  stars: { vx: number; vy: number; rot: number }[];
  points: number;
  elapsed: number;
};

export function createMarioSkin(): ArkanoidSkin {
  let bg: HTMLCanvasElement | null = null;
  const blocks = new Map<BlockColor, HTMLCanvasElement>();
  let paddle: HTMLCanvasElement | null = null;
  let ball: HTMLCanvasElement | null = null;
  let bursts: Burst[] = [];

  const cache = (w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (ctx) paint(ctx);
    return canvas;
  };

  const blockSprite = (color: BlockColor) => {
    let s = blocks.get(color);
    if (!s) {
      s = cache(BLOCK_W, BLOCK_H, (c) => paintBlock(c, color));
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
      if (!bg) bg = cache(W, H, paintBackground);
      ctx.drawImage(bg, 0, 0);
    },
    drawBlock(ctx, b) {
      ctx.drawImage(blockSprite(b.color), b.x, b.y);
    },
    drawExplosion(ctx, exp, t) {
      // Destello blanco breve; los pedazos van en drawEffects
      ctx.globalAlpha = (1 - t) * 0.85;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(exp.x + 1, exp.y + 1, exp.w - 2, exp.h - 2, 5);
      ctx.fill();
      ctx.globalAlpha = 1;
    },
    drawPaddle(ctx, p) {
      if (!paddle) paddle = cache(PADDLE_W, PADDLE_H, paintPaddle);
      // Sombra plana bajo la plataforma
      ctx.fillStyle = "rgba(20, 40, 90, 0.25)";
      ctx.beginPath();
      ctx.roundRect(p.x + 4, p.y + p.h, p.w - 8, 4, 2);
      ctx.fill();
      ctx.drawImage(paddle, p.x, p.y, p.w, p.h);
    },
    drawBall(ctx, b) {
      if (!ball) ball = cache(BALL_SIZE, BALL_SIZE, paintBall);
      ctx.drawImage(ball, b.x, b.y, b.w, b.h);
    },
    drawOverlay(ctx, title, lines) {
      ctx.fillStyle = C.veil;
      ctx.fillRect(0, 0, W, H);

      let size = 52;
      ctx.font = `bold ${size}px ${FONT_FAMILY}`;
      while (size > 20 && ctx.measureText(title).width > PANEL_W - 70) {
        size -= 2;
        ctx.font = `bold ${size}px ${FONT_FAMILY}`;
      }
      const lineH = 30;
      const panelH = 36 + size + 20 + lines.length * lineH + 20;
      const px = (W - PANEL_W) / 2;
      const py = (H - panelH) / 2;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
      ctx.shadowOffsetY = 8;
      ctx.shadowBlur = 14;
      ctx.fillStyle = C.panel;
      ctx.beginPath();
      ctx.roundRect(px, py, PANEL_W, panelH, 28);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = C.panelText;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(px, py, PANEL_W, panelH, 28);
      ctx.stroke();

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      const titleY = py + 36 + size / 2;
      ctx.font = `bold ${size}px ${FONT_FAMILY}`;
      ctx.lineWidth = 10;
      ctx.strokeStyle = C.panelText;
      ctx.strokeText(title, W / 2, titleY);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(title, W / 2, titleY);
      ctx.font = `bold 20px ${FONT_FAMILY}`;
      ctx.fillStyle = C.panelText;
      lines.forEach((line, i) =>
        ctx.fillText(line, W / 2, py + 36 + size + 20 + lineH / 2 + i * lineH),
      );
      ctx.restore();
    },
    onBlockHit(b, points) {
      const hw = b.w / 2;
      const hh = b.h / 2;
      const fragments: Fragment[] = [];
      for (let i = 0; i < 4; i++) {
        const right = i % 2;
        const bottom = i >> 1;
        fragments.push({
          sx: right * hw,
          sy: bottom * hh,
          x: b.x + right * hw,
          y: b.y + bottom * hh,
          vx: (right ? 1 : -1) * (0.06 + Math.random() * 0.06),
          vy: bottom ? -0.2 : -0.38,
        });
      }
      const stars = Array.from({ length: 3 }, (_, i) => ({
        vx: (i - 1) * 0.12 + (Math.random() - 0.5) * 0.04,
        vy: -0.12 - Math.random() * 0.06,
        rot: Math.random() * Math.PI,
      }));
      bursts.push({
        color: b.color,
        cx: b.x + hw,
        cy: b.y + hh,
        fragments,
        stars,
        points,
        elapsed: 0,
      });
    },
    updateEffects(dtMs) {
      if (!bursts.length) return;
      for (const b of bursts) b.elapsed += dtMs;
      bursts = bursts.filter((b) => b.elapsed < FRAGMENT_MS);
    },
    drawEffects(ctx) {
      for (const b of bursts) {
        const e = b.elapsed;
        // Pedazos del bloque con gravedad
        const sprite = blockSprite(b.color);
        const hw = BLOCK_W / 2;
        const hh = BLOCK_H / 2;
        for (const f of b.fragments) {
          const x = f.x + f.vx * e;
          const y = f.y + f.vy * e + 0.5 * GRAVITY * e * e;
          ctx.save();
          ctx.translate(x + hw / 2, y + hh / 2);
          ctx.rotate(f.vx * e * 0.02);
          ctx.drawImage(sprite, f.sx, f.sy, hw, hh, -hw / 2, -hh / 2, hw, hh);
          ctx.restore();
        }

        if (e < STARS_MS) {
          const t = e / STARS_MS;
          ctx.globalAlpha = 1 - t;
          for (const s of b.stars)
            drawStar(ctx, b.cx + s.vx * e, b.cy + s.vy * e, 6 + 3 * t, s.rot + t * 3);
          ctx.globalAlpha = 1;
        }

        if (e < POPUP_MS) {
          // Moneda que sube girando con los puntos encima
          const t = e / POPUP_MS;
          const y = b.cy - 10 - Math.sin(Math.min(1, t * 1.6) * (Math.PI / 2)) * 40;
          ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
          drawCoin(ctx, b.cx, y, Math.abs(Math.cos(t * Math.PI * 3)));
          ctx.save();
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineJoin = "round";
          ctx.font = `bold 18px ${FONT_FAMILY}`;
          ctx.lineWidth = 5;
          ctx.strokeStyle = C.panelText;
          ctx.strokeText(`+${b.points}`, b.cx, y - 20);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(`+${b.points}`, b.cx, y - 20);
          ctx.restore();
          ctx.globalAlpha = 1;
        }
      }
    },
    resetEffects() {
      bursts = [];
    },
  };
}
