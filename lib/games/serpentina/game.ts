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
import { drawBackground } from "./draw";
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
      status: state,
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
    if (food === null) state = "gameover"; // tablero lleno
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    const turn = KEY_TO_DIRECTION[e.code];
    if (!turn || state !== "playing") return;
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

  // La pausa llega en el paso 4 del plan; hasta entonces son no-op
  function pause() {}
  function resume() {}

  function restart() {
    reset();
    emitHud();
    startLoop();
  }

  // ── Arranque ────────────────────────────────────────────────────────────────
  reset();
  emitHud();
  window.addEventListener("keydown", onKeyDown);
  startLoop();

  return {
    pause,
    resume,
    restart,
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
