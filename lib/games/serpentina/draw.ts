import { COLORS, FONT_FAMILY, GROUND_H, H, W } from "./constants";

// Escenario estático (cielo, nubes, colinas, suelo). Posiciones fijas: sin azar y sin estado,
// así el motor lo dibuja una sola vez en un canvas fuera de pantalla.

function drawSky(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, COLORS.skyTop);
  sky.addColorStop(1, COLORS.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
}

// [dx, dy, radio] de los bultos de una nube de ~100 px de ancho
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
  pass(COLORS.cloudShadow, 5);
  pass(COLORS.cloud, 0);
}

function drawClouds(ctx: CanvasRenderingContext2D) {
  drawCloud(ctx, 60, 70, 1.2);
  drawCloud(ctx, 330, 40, 1);
  drawCloud(ctx, 560, 110, 1.3);
  drawCloud(ctx, 690, 30, 0.8);
  drawCloud(ctx, 180, 170, 0.9);
}

function drawHill(
  ctx: CanvasRenderingContext2D,
  x: number,
  rx: number,
  ry: number,
  color: string,
) {
  const base = H - GROUND_H;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, base, rx, ry, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // Franja de luz para dar volumen
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.28, base, rx * 0.34, ry * 0.8, 0, Math.PI, Math.PI * 2);
  ctx.fill();
}

function drawHills(ctx: CanvasRenderingContext2D) {
  // Fila de atrás (más alta) y fila de delante (más baja)
  drawHill(ctx, 110, 130, 150, COLORS.hillMint);
  drawHill(ctx, 360, 110, 190, COLORS.hillPink);
  drawHill(ctx, 610, 140, 130, COLORS.hillYellow);
  drawHill(ctx, 760, 100, 170, COLORS.hillMint);
  drawHill(ctx, 230, 90, 70, COLORS.hillYellow);
  drawHill(ctx, 500, 100, 60, COLORS.hillMint);
  drawHill(ctx, 40, 80, 80, COLORS.hillPink);
}

function drawGround(ctx: CanvasRenderingContext2D) {
  const top = H - GROUND_H;
  const grassH = 12;

  ctx.fillStyle = COLORS.soil;
  ctx.fillRect(0, top, W, GROUND_H);

  // Ondas de la tierra
  ctx.strokeStyle = COLORS.soilWave;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x < W; x += 20) {
    ctx.moveTo(x, top + grassH + 12);
    ctx.arc(x + 10, top + grassH + 12, 8, Math.PI, 0);
  }
  ctx.stroke();

  // Hierba con borde ondulado
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, top, W, grassH);
  ctx.beginPath();
  for (let x = 0; x < W; x += 10) {
    ctx.moveTo(x + 10, top + grassH);
    ctx.arc(x + 5, top + grassH, 5, 0, Math.PI);
  }
  ctx.fill();
  ctx.fillStyle = COLORS.grassDark;
  ctx.fillRect(0, top, W, 3);
}

export function drawBackground(ctx: CanvasRenderingContext2D) {
  drawSky(ctx);
  drawClouds(ctx);
  drawHills(ctx);
  drawGround(ctx);
}

const PANEL_W = 640;

// Velo azul + cartel crema con contorno marrón. El título se encoge hasta caber en el panel.
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  title: string,
  titleSize: number,
  lines: string[],
) {
  ctx.fillStyle = COLORS.veil;
  ctx.fillRect(0, 0, W, H);

  let size = titleSize;
  ctx.font = `bold ${size}px ${FONT_FAMILY}`;
  while (size > 20 && ctx.measureText(title).width > PANEL_W - 80) {
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
  ctx.fillStyle = COLORS.panel;
  ctx.beginPath();
  ctx.roundRect(px, py, PANEL_W, panelH, 28);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = COLORS.panelText;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(px, py, PANEL_W, panelH, 28);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";

  const titleY = py + 36 + size / 2;
  ctx.font = `bold ${size}px ${FONT_FAMILY}`;
  ctx.lineWidth = 10;
  ctx.strokeStyle = COLORS.panelText;
  ctx.strokeText(title, W / 2, titleY);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(title, W / 2, titleY);

  ctx.font = `bold 20px ${FONT_FAMILY}`;
  ctx.fillStyle = COLORS.panelText;
  lines.forEach((line, i) => ctx.fillText(line, W / 2, py + 36 + size + 20 + lineH / 2 + i * lineH));
}
