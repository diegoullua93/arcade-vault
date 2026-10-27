export type GameStatus = "playing" | "dead" | "gameover" | "paused";

export type GameHud = {
  score: number;
  lives: number;
  level: number;
  status: GameStatus;
};

export type GameCallbacks = {
  onHudChange: (hud: GameHud) => void; // solo cuando cambia algún campo
};

export type GameInstance = {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void; // cancela rAF y retira todos los listeners
};
