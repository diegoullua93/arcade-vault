import {
  BASE_STEP_MS,
  COLS,
  FOOD_PER_LEVEL,
  MIN_STEP_MS,
  ROWS,
  STEP_DECREMENT_MS,
} from "./constants";
import type { Cell, Direction } from "./entities";

export function levelFor(eaten: number): number {
  return Math.floor(eaten / FOOD_PER_LEVEL) + 1;
}

export function stepInterval(level: number): number {
  return Math.max(MIN_STEP_MS, BASE_STEP_MS - (level - 1) * STEP_DECREMENT_MS);
}

// Los bordes se atraviesan: sale por un lado y entra por el opuesto
export function wrap(cell: Cell): Cell {
  return { x: (cell.x + COLS) % COLS, y: (cell.y + ROWS) % ROWS };
}

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function isOpposite(a: Direction, b: Direction): boolean {
  return OPPOSITE[a] === b;
}

// Elige entre las celdas libres (no por reintentos); null si el tablero está lleno
export function randomFreeCell(snake: Cell[], random: () => number): Cell | null {
  const taken = new Set(snake.map((c) => c.y * COLS + c.x));
  const free: Cell[] = [];
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) if (!taken.has(y * COLS + x)) free.push({ x, y });
  if (free.length === 0) return null;
  return free[Math.floor(random() * free.length)];
}
