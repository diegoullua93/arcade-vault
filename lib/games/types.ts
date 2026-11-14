import type { SkinId } from "./skins";

export type GameStatus = "playing" | "dead" | "gameover" | "paused";

export type GameHud = {
  score: number;
  lives: number;
  level: number;
  status: GameStatus;
};

// Matriz de una pieza: 0 = vacío, 1..N = índice de color
export type NextShape = number[][];

export type GameCallbacks = {
  onHudChange: (hud: GameHud) => void; // solo cuando cambia algún campo
  onNextChange?: (shape: NextShape) => void; // solo cuando cambia la pieza siguiente
};

// El skin se fija al crear el motor; cambiarlo = destroy() + crear otro motor
export type GameOptions = {
  skin?: SkinId;
};

export type GameInstance = {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void; // cancela rAF y retira todos los listeners
};
