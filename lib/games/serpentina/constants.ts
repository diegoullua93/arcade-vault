export const W = 800;
export const H = 600;

export const CELL = 20;
export const COLS = W / CELL; // 40
export const ROWS = H / CELL; // 30

export const INITIAL_LENGTH = 3;
export const FOOD_PER_LEVEL = 5;
export const POINTS_PER_FOOD = 10;

export const BASE_STEP_MS = 150;
export const STEP_DECREMENT_MS = 10;
export const MIN_STEP_MS = 60;

export const MAX_QUEUED_TURNS = 2;

export const GROUND_H = 40; // franja decorativa de suelo en la parte inferior

export const EAT_STARS_MS = 300;
export const EAT_TEXT_MS = 500;

// Fuente redondeada del sistema para los textos del canvas (no se carga ninguna fuente nueva)
export const FONT_FAMILY = "'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif";

export const COLORS = {
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
  checker: "rgba(255, 255, 255, 0.08)",
  snake: "#ffa41c",
  snakeLight: "#ffc247",
  snakeOutline: "#6b3410",
  cheek: "rgba(255, 105, 140, 0.65)",
  coin: "#ffd21f",
  coinInner: "#ffe97a",
  coinOutline: "#a86d0a",
  star: "#fff04d",
  popup: "#ffffff",
  popupOutline: "#6b3410",
  veil: "rgba(18, 46, 105, 0.55)",
  panel: "#fff4d6",
  panelText: "#6b3410",
} as const;
