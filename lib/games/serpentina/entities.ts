import { CELL, COLORS, COLS, EAT_STARS_MS, EAT_TEXT_MS, FONT_FAMILY, ROWS } from "./constants";

export type Cell = { x: number; y: number }; // columna 0..COLS-1, fila 0..ROWS-1
export type Direction = "up" | "down" | "left" | "right";

// Destello y puntos flotantes al comer; solo adorno, no afecta a las reglas
export type EatEffect = {
  x: number; // centro en píxeles
  y: number;
  points: number;
  elapsed: number; // ms
};

export const DIRECTION_VECTORS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

// Damero sutil para que se perciba la celda sin competir con la serpiente
export function drawCheckerboard(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = COLORS.checker;
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if ((x + y) % 2 === 0) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
}

function drawBodySegment(ctx: CanvasRenderingContext2D, cell: Cell, index: number) {
  const x = cell.x * CELL + 1;
  const y = cell.y * CELL + 1;
  const size = CELL - 2;

  ctx.fillStyle = index % 2 === 0 ? COLORS.snake : COLORS.snakeLight;
  ctx.strokeStyle = COLORS.snakeOutline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 6);
  ctx.fill();
  ctx.stroke();

  // Brillo de dibujo animado
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.beginPath();
  ctx.ellipse(x + 6, y + 5, 3.5, 2, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawHead(ctx: CanvasRenderingContext2D, cell: Cell, dir: Direction) {
  const { dx, dy } = DIRECTION_VECTORS[dir];
  const px = -dy; // perpendicular a la dirección
  const py = dx;
  const cx = cell.x * CELL + CELL / 2;
  const cy = cell.y * CELL + CELL / 2;

  ctx.fillStyle = COLORS.snake;
  ctx.strokeStyle = COLORS.snakeOutline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cell.x * CELL, cell.y * CELL, CELL, CELL, 8);
  ctx.fill();
  ctx.stroke();

  // Mejillas
  ctx.fillStyle = COLORS.cheek;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx - dx * 4 + px * side * 6, cy - dy * 4 + py * side * 6, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ojos grandes que miran hacia donde va la serpiente
  for (const side of [-1, 1]) {
    const ex = cx + dx * 3 + px * side * 4;
    const ey = cy + dy * 3 + py * side * 4;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = COLORS.snakeOutline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ex, ey, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(ex + dx * 1.4, ey + dy * 1.4, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

// snake[0] es la cabeza; se dibuja de la cola a la cabeza para que la cabeza quede encima
// `visible` (opcional) permite saltar las celdas que quedan fuera de la zona que se repinta
export function drawSnake(
  ctx: CanvasRenderingContext2D,
  snake: Cell[],
  dir: Direction,
  visible?: (cell: Cell) => boolean,
) {
  for (let i = snake.length - 1; i >= 1; i--)
    if (!visible || visible(snake[i])) drawBodySegment(ctx, snake[i], i);
  if (!visible || visible(snake[0])) drawHead(ctx, snake[0], dir);
}

// La moneda gira: su ancho oscila con el tiempo del motor (ms)
export function drawCoin(ctx: CanvasRenderingContext2D, cell: Cell, time: number) {
  const cx = cell.x * CELL + CELL / 2;
  const cy = cell.y * CELL + CELL / 2;
  const squeeze = Math.max(0.18, Math.abs(Math.cos(time * 0.005)));
  const rx = 8 * squeeze;

  ctx.fillStyle = COLORS.coin;
  ctx.strokeStyle = COLORS.coinOutline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = COLORS.coinInner;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.55, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.3, cy - 4, Math.max(0.8, rx * 0.15), 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const radius = i % 2 === 0 ? r : r * 0.42;
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

export function drawEatEffect(ctx: CanvasRenderingContext2D, effect: EatEffect) {
  if (effect.elapsed < EAT_STARS_MS) {
    const t = effect.elapsed / EAT_STARS_MS;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = COLORS.star;
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 2) * i + Math.PI / 4;
      const dist = 8 + t * 18;
      drawStar(ctx, effect.x + Math.cos(angle) * dist, effect.y + Math.sin(angle) * dist, 5 * (1 - t * 0.4));
    }
    ctx.restore();
  }

  if (effect.elapsed < EAT_TEXT_MS) {
    const t = effect.elapsed / EAT_TEXT_MS;
    ctx.save();
    ctx.globalAlpha = 1 - t * t;
    ctx.font = `bold 18px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.popupOutline;
    ctx.fillStyle = COLORS.popup;
    const text = `+${effect.points}`;
    const y = effect.y - 14 - t * 22;
    ctx.strokeText(text, effect.x, y);
    ctx.fillText(text, effect.x, y);
    ctx.restore();
  }
}
