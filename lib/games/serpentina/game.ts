import type { GameCallbacks, GameHud, GameInstance } from "../types";
import {
  CELL,
  COLS,
  EAT_TEXT_MS,
  H,
  INITIAL_LENGTH,
  MAX_QUEUED_TURNS,
  POINTS_PER_FOOD,
  ROWS,
  W,
} from "./constants";
import { drawBackground, drawOverlay } from "./draw";
import {
  drawCheckerboard,
  drawCoin,
  drawEatEffect,
  drawSnake,
  type Cell,
  type Direction,
  type EatEffect,
} from "./entities";
import { advance, isOpposite, levelFor, randomFreeCell, stepInterval } from "./utils";

type State = "playing" | "gameover";

const BLOCKED_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export function createSerpentinaGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameInstance {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { pause() {}, resume() {}, restart() {}, destroy() {} };
  }

  // Escenario estático cacheado: cielo, colinas, suelo y damero
  const background = document.createElement("canvas");
  background.width = W;
  background.height = H;
  const bgCtx = background.getContext("2d");
  if (bgCtx) {
    drawBackground(bgCtx);
    drawCheckerboard(bgCtx);
  }

  // ── Estado del juego ────────────────────────────────────────────────────────
  let snake: Cell[] = []; // snake[0] es la cabeza
  let dir: Direction = "right"; // dirección del último paso
  let queue: Direction[] = []; // giros pendientes
  let food: Cell | null = null;
  let eaten = 0;
  let score = 0;
  let state: State = "playing";
  let won = false; // gameover por llenar el tablero
  let paused = false;
  let acc = 0; // ms acumulados desde el último paso
  let time = 0; // ms de motor, para animar la moneda
  let effects: EatEffect[] = [];

  let lastTime: number | null = null;
  let rafId = 0;
  let lastHud: GameHud | null = null;

  function emitHud() {
    const hud: GameHud = {
      score,
      lives: 0,
      level: levelFor(eaten),
      status: paused ? "paused" : state,
    };
    if (
      lastHud &&
      lastHud.score === hud.score &&
      lastHud.lives === hud.lives &&
      lastHud.level === hud.level &&
      lastHud.status === hud.status
    ) {
      return;
    }
    lastHud = hud;
    callbacks.onHudChange(hud);
  }

  // ── Lógica ──────────────────────────────────────────────────────────────────
  function reset() {
    const headX = Math.floor(COLS / 2);
    const headY = Math.floor(ROWS / 2);
    snake = Array.from({ length: INITIAL_LENGTH }, (_, i) => ({ x: headX - i, y: headY }));
    dir = "right";
    queue = [];
    eaten = 0;
    score = 0;
    state = "playing";
    won = false;
    acc = 0;
    effects = [];
    food = randomFreeCell(snake, Math.random);
  }

  function step() {
    const turn = queue.shift();
    if (turn) dir = turn;

    const head = advance(snake[0], dir);
    const eating = food !== null && head.x === food.x && head.y === food.y;

    // Si no come, la cola se libera en este mismo paso y no cuenta como colisión
    const body = eating ? snake : snake.slice(0, -1);
    if (body.some((c) => c.x === head.x && c.y === head.y)) {
      state = "gameover";
      return;
    }

    snake.unshift(head);
    if (!eating) {
      snake.pop();
      return;
    }

    const points = POINTS_PER_FOOD * levelFor(eaten);
    score += points;
    eaten += 1;
    effects.push({ x: head.x * CELL + CELL / 2, y: head.y * CELL + CELL / 2, points, elapsed: 0 });

    food = randomFreeCell(snake, Math.random);
    if (food === null) {
      state = "gameover";
      won = true;
    }
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (BLOCKED_KEYS.includes(e.code)) e.preventDefault();

    if (e.code === "KeyP" || e.code === "Escape") {
      if (!e.repeat) (paused ? resume : pause)();
      return;
    }

    if (paused) return;
    if (state === "gameover") {
      // Solo la pulsación inicial: mantener Espacio no reinicia en cadena
      if (e.code === "Space" && !e.repeat) restart();
      return;
    }

    const turn = KEY_TO_DIRECTION[e.code];
    if (!turn) return;
    if (queue.length >= MAX_QUEUED_TURNS) return;

    // Se compara con el último giro encolado (o la dirección actual): sin 180° ni repetidos
    const reference = queue.length > 0 ? queue[queue.length - 1] : dir;
    if (turn === reference || isOpposite(reference, turn)) return;
    queue.push(turn);
  };

  // ── Update ──────────────────────────────────────────────────────────────────
  function update(dtMs: number) {
    time += dtMs;
    for (const effect of effects) effect.elapsed += dtMs;
    effects = effects.filter((effect) => effect.elapsed < EAT_TEXT_MS);

    if (state !== "playing") return;

    // Con dt ≤ 50 ms e intervalo ≥ 60 ms nunca hay más de un paso por frame
    acc += dtMs;
    const interval = stepInterval(levelFor(eaten));
    if (acc >= interval) {
      acc -= interval;
      step();
    }
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  function draw() {
    if (!ctx) return;
    ctx.drawImage(background, 0, 0);
    if (food) drawCoin(ctx, food, time);
    drawSnake(ctx, snake, dir);
    for (const effect of effects) drawEatEffect(ctx, effect);

    if (state === "gameover") {
      const lines = [`PUNTAJE: ${score}`, "ESPACIO PARA REINICIAR"];
      if (won) drawOverlay(ctx, "¡TABLERO COMPLETO!", 48, lines);
      else drawOverlay(ctx, "GAME OVER", 64, lines);
    }

    if (paused) drawOverlay(ctx, "PAUSA", 56, ["P / ESC PARA CONTINUAR"]);
  }

  // ── Loop principal ──────────────────────────────────────────────────────────
  function loop(ts: number) {
    const dtMs = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;
    update(dtMs);
    draw();
    emitHud();
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    cancelAnimationFrame(rafId);
    lastTime = null; // el primer dt es 0
    rafId = requestAnimationFrame(loop);
  }

  function pause() {
    // En gameover no hay nada que pausar
    if (paused || state === "gameover") return;
    paused = true;
    cancelAnimationFrame(rafId);
    draw();
    emitHud();
  }

  function resume() {
    if (!paused) return;
    paused = false;
    emitHud();
    startLoop();
  }

  function restart() {
    reset();
    paused = false;
    emitHud();
    startLoop();
  }

  const onBlur = () => pause();
  const onVisibilityChange = () => {
    if (document.hidden) pause();
  };

  // ── Arranque ────────────────────────────────────────────────────────────────
  reset();
  emitHud();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibilityChange);
  startLoop();

  return {
    pause,
    resume,
    restart,
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}
