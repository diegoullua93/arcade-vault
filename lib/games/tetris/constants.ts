export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30;

export const W = COLS * BLOCK; // 300
export const H = ROWS * BLOCK; // 600

export const GRID_LINE = "#22222e";

// Indexados por tipo de pieza: 1 I, 2 O, 3 T, 4 S, 5 Z, 6 J, 7 L, 8 N (tuerca)
export const COLORS = [
  "",
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
  "#9e9e9e", // N - tuerca (gris metálico)
];

export const PIECES: number[][][] = [
  [],
  [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
  [[2, 2], [2, 2]], // O
  [[0, 3, 0], [3, 3, 3], [0, 0, 0]], // T
  [[0, 4, 4], [4, 4, 0], [0, 0, 0]], // S
  [[5, 5, 0], [0, 5, 5], [0, 0, 0]], // Z
  [[6, 0, 0], [6, 6, 6], [0, 0, 0]], // J
  [[0, 0, 7], [7, 7, 7], [0, 0, 0]], // L
  [[8, 8, 8], [8, 0, 8], [8, 8, 8]], // N (tuerca)
];

export const PIECE_TYPES = PIECES.length - 1; // 8, como `Math.random() * 8 + 1` de la referencia

export const LINE_SCORES = [0, 100, 300, 500, 800];

export const KICKS = [0, -1, 1, -2, 2];

export const INITIAL_DROP_INTERVAL = 1000; // ms
export const MIN_DROP_INTERVAL = 100;
export const DROP_STEP = 90; // ms menos por nivel
export const LINES_PER_LEVEL = 10;
