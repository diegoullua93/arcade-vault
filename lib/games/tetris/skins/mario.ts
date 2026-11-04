import { COLS, H, ROWS, W } from "../constants";
import type { TetrisSkin } from "./types";

// Plataformero colorido, con la paleta y las técnicas de Serpentina (lib/games/serpentina):
// cielo en degradado, nubes, colinas y damero cacheados; bloques con bisel y remaches; estrellas
// y puntos flotantes al limpiar líneas; cartel crema para PAUSA / GAME OVER.

const FONT_FAMILY = "'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif";

const SKY = {
  top: "#4a90f0",
  bottom: "#bfe3ff",
  cloud: "#ffffff",
  cloudShadow: "#bcd6f2",
  hillMint: "#a6dcae",
  hillPink: "#f4b0c6",
  hillYellow: "#f6e08a",
  grass: "#5dbb3a",
  grassDark: "#3e8e2b",
  checker: "rgba(255, 255, 255, 0.1)",
  outline: "#4a2a10",
  star: "#fff04d",
  veil: "rgba(18, 46, 105, 0.55)",
  panel: "#fff4d6",
  panelText: "#6b3410",
} as const;

// [base, luz, sombra] por tipo de pieza: 1 I, 2 O, 3 T, 4 S, 5 Z, 6 J, 7 L, 8 N (ladrillo)
const BLOCKS: readonly (readonly [string, string, string])[] = [
  ["", "", ""],
  ["#36c5f0", "#9be6ff", "#1a7fb0"],
  ["#ffd21f", "#ffe97a", "#c98a0a"],
  ["#b45cf0", "#dcaaff", "#7430b0"],
  ["#5dbb3a", "#a4e47e", "#3e8e2b"],
  ["#f0533c", "#ff9c8a", "#a8281a"],
  ["#3c6cf0", "#9cb6ff", "#2040a8"],
  ["#ff9a1c", "#ffc878", "#c0640a"],
  ["#c8743c", "#e8a878", "#8a4a1e"],
];
const BRICK = 8;

const STARS_MS = 450;
const POPUP_MS = 800;

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
  pass(SKY.cloudShadow, 5);
  pass(SKY.cloud, 0);
}

function drawHill(ctx: CanvasRenderingContext2D, x: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, H, rx, ry, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.28, H, rx * 0.34, ry * 0.8, 0, Math.PI, Math.PI * 2);
  ctx.fill();
}

function paintBackground(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, SKY.top);
  sky.addColorStop(1, SKY.bottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  drawCloud(ctx, 30, 70, 0.8);
  drawCloud(ctx, 180, 150, 0.65);
  drawCloud(ctx, 60, 260, 0.55);
  drawCloud(ctx, 200, 340, 0.7);

  drawHill(ctx, 40, 110, 210, SKY.hillMint);
  drawHill(ctx, 230, 120, 170, SKY.hillPink);
  drawHill(ctx, 130, 90, 90, SKY.hillYellow);
  drawHill(ctx, 300, 70, 110, SKY.hillMint);

  // Franja de hierba en la base: el suelo sobre el que se apilan las piezas
  ctx.fillStyle = SKY.grass;
  ctx.fillRect(0, H - 6, W, 6);
  ctx.fillStyle = SKY.grassDark;
  ctx.fillRect(0, H - 6, W, 2);

  const block = W / COLS;
  ctx.fillStyle = SKY.checker;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if ((r + c) % 2 === 0) ctx.fillRect(c * block, r * block, block, block);
}

function paintBlock(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  colorIndex: number,
  size: number,
) {
  const [base, light, dark] = BLOCKS[colorIndex] ?? BLOCKS[BRICK];
  const x = col * size;
  const y = row * size;
  const b = Math.max(2, Math.round(size / 10)); // grosor del bisel
  const r = size * 0.18;

  ctx.fillStyle = SKY.outline;
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, size - 2, size - 2, r);
  ctx.fill();
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 3, size - 6, size - 6, r - 2);
  ctx.fill();

  // Bisel: luz arriba/izquierda, sombra abajo/derecha
  ctx.fillStyle = light;
  ctx.fillRect(x + 5, y + 4, size - 10, b);
  ctx.fillRect(x + 4, y + 5, b, size - 10);
  ctx.fillStyle = dark;
  ctx.fillRect(x + 5, y + size - 4 - b, size - 10, b);
  ctx.fillRect(x + size - 4 - b, y + 5, b, size - 10);

  if (colorIndex === BRICK) {
    // Juntas de ladrillo
    ctx.fillStyle = dark;
    const mid = y + size / 2 - 1;
    ctx.fillRect(x + 4, mid, size - 8, 2);
    ctx.fillRect(x + size / 2 - 1, y + 4, 2, size / 2 - 5);
    ctx.fillRect(x + size / 4, mid + 2, 2, size / 2 - 6);
    ctx.fillRect(x + (size * 3) / 4 - 2, mid + 2, 2, size / 2 - 6);
  } else {
    // Remaches en las esquinas
    ctx.fillStyle = dark;
    const o = Math.round(size * 0.27);
    const d = Math.max(2, Math.round(size / 12));
    ctx.fillRect(x + o, y + o, d, d);
    ctx.fillRect(x + size - o - d, y + o, d, d);
    ctx.fillRect(x + o, y + size - o - d, d, d);
    ctx.fillRect(x + size - o - d, y + size - o - d, d, d);
  }

  // Brillo de dibujo animado
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.beginPath();
  ctx.ellipse(x + size * 0.3, y + size * 0.26, size * 0.1, size * 0.06, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

function paintGhost(ctx: CanvasRenderingContext2D, col: number, row: number, size: number) {
  const x = col * size;
  const y = row * size;
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 3, size - 6, size - 6, size * 0.16);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = SKY.star;
  ctx.fill();
  ctx.strokeStyle = SKY.panelText;
  ctx.lineWidth = 2;
  ctx.stroke();
}

type Star = { x: number; y: number; vx: number; vy: number; rot: number };
type Burst = { stars: Star[]; popupY: number; points: number; elapsed: number };

const PANEL_W = 264;

export function createMarioSkin(): TetrisSkin {
  let bg: HTMLCanvasElement | null = null;
  let bursts: Burst[] = [];

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
      if (colorIndex) paintBlock(ctx, col, row, colorIndex, size);
    },
    drawGhost(ctx, col, row, colorIndex, size) {
      if (colorIndex) paintGhost(ctx, col, row, size);
    },
    drawPreviewBackground(ctx, size) {
      // Solo se repinta al cambiar la pieza siguiente, no por frame
      const sky = ctx.createLinearGradient(0, 0, 0, size);
      sky.addColorStop(0, SKY.top);
      sky.addColorStop(1, SKY.bottom);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, size, size);
    },
    drawOverlay(ctx, title, lines, veil) {
      if (veil) {
        ctx.fillStyle = SKY.veil;
        ctx.fillRect(0, 0, W, H);
      }
      let size = 34;
      ctx.font = `bold ${size}px ${FONT_FAMILY}`;
      while (size > 18 && ctx.measureText(title).width > PANEL_W - 40) {
        size -= 2;
        ctx.font = `bold ${size}px ${FONT_FAMILY}`;
      }
      const lineH = 26;
      const panelH = 28 + size + 18 + lines.length * lineH + 14;
      const px = (W - PANEL_W) / 2;
      const py = (H - panelH) / 2;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
      ctx.shadowOffsetY = 6;
      ctx.shadowBlur = 12;
      ctx.fillStyle = SKY.panel;
      ctx.beginPath();
      ctx.roundRect(px, py, PANEL_W, panelH, 22);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = SKY.panelText;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(px, py, PANEL_W, panelH, 22);
      ctx.stroke();

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      const titleY = py + 28 + size / 2;
      ctx.font = `bold ${size}px ${FONT_FAMILY}`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = SKY.panelText;
      ctx.strokeText(title, W / 2, titleY);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(title, W / 2, titleY);
      ctx.font = `bold 15px ${FONT_FAMILY}`;
      ctx.fillStyle = SKY.panelText;
      lines.forEach((line, i) =>
        ctx.fillText(line, W / 2, py + 28 + size + 18 + lineH / 2 + i * lineH),
      );
      ctx.restore();
    },
    onLinesCleared(rows, points) {
      const block = W / COLS;
      const stars: Star[] = [];
      for (const r of rows) {
        for (let i = 0; i < 5; i++) {
          stars.push({
            x: (i + 0.5) * (W / 5) + (Math.random() - 0.5) * 20,
            y: r * block + block / 2,
            vx: (Math.random() - 0.5) * 0.12,
            vy: -0.08 - Math.random() * 0.08,
            rot: Math.random() * Math.PI,
          });
        }
      }
      const avg = rows.reduce((a, r) => a + r, 0) / Math.max(1, rows.length);
      bursts.push({ stars, popupY: avg * block + block / 2, points, elapsed: 0 });
    },
    updateEffects(dtMs) {
      if (!bursts.length) return;
      for (const b of bursts) b.elapsed += dtMs;
      bursts = bursts.filter((b) => b.elapsed < POPUP_MS);
    },
    drawEffects(ctx) {
      for (const b of bursts) {
        if (b.elapsed < STARS_MS) {
          const t = b.elapsed / STARS_MS;
          ctx.globalAlpha = 1 - t;
          for (const s of b.stars)
            drawStar(ctx, s.x + s.vx * b.elapsed, s.y + s.vy * b.elapsed, 8 + 4 * t, s.rot + t * 3);
          ctx.globalAlpha = 1;
        }
        const t = b.elapsed / POPUP_MS;
        ctx.save();
        ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.font = `bold 26px ${FONT_FAMILY}`;
        const y = b.popupY - t * 50;
        ctx.lineWidth = 6;
        ctx.strokeStyle = SKY.panelText;
        ctx.strokeText(`+${b.points}`, W / 2, y);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`+${b.points}`, W / 2, y);
        ctx.restore();
      }
    },
    resetEffects() {
      bursts = [];
    },
  };
}
