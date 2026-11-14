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

  // Repintado parcial: la serpiente solo cambia en cada paso; entre pasos solo animan la moneda
  // y los destellos. `fullRedraw` repinta todo; si no, solo las zonas animadas (rectángulos
  // planos [x, y, w, h, ...] reutilizados para no asignar memoria por frame).
  let fullRedraw = true;
  let dirtyCur: number[] = [];
  let dirtyPrev: number[] = [];

  function emitHud() {
    const status = paused ? "paused" : state;
    const level = levelFor(eaten);
    if (
      lastHud &&
      lastHud.score === score &&
      lastHud.level === level &&
      lastHud.status === status
    ) {
      return;
    }
    lastHud = { score, lives: 0, level, status };
    callbacks.onHudChange(lastHud);
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
    fullRedraw = true;
  }

  function step() {
    const turn = queue.shift();
    if (turn) dir = turn;

    const head = advance(snake[0], dir);
    const eating = food !== null && head.x === food.x && head.y === food.y;

    // Si no come, la cola se libera en este mismo paso y no cuenta como colisión
    const bodyLength = eating ? snake.length : snake.length - 1;
    for (let i = 0; i < bodyLength; i++) {
      if (snake[i].x === head.x && snake[i].y === head.y) {
        state = "gameover";
        return;
      }
    }

    fullRedraw = true; // la serpiente cambia (y quizá la moneda): se repinta todo
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
    // Avanza y descarta los efectos terminados en el sitio (sin crear un array por frame)
    let kept = 0;
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      effect.elapsed += dtMs;
      if (effect.elapsed < EAT_TEXT_MS) effects[kept++] = effect;
    }
    effects.length = kept;

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
  function pushRect(rects: number[], x: number, y: number, w: number, h: number) {
    // Recortado al lienzo: drawImage con origen fuera de la imagen no es fiable
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(W, Math.ceil(x + w));
    const y1 = Math.min(H, Math.ceil(y + h));
    if (x1 > x0 && y1 > y0) rects.push(x0, y0, x1 - x0, y1 - y0);
  }

  // Zonas que cambian entre pasos: la moneda (cabe en su celda) y cada destello/puntos flotantes
  // (estrellas hasta ~31 px del centro; el texto sube hasta ~47 px y mide ≲ 60 px de ancho)
  function collectAnimatedRects(rects: number[]) {
    rects.length = 0;
    if (food) pushRect(rects, food.x * CELL - 2, food.y * CELL - 2, CELL + 4, CELL + 4);
    for (const effect of effects) pushRect(rects, effect.x - 44, effect.y - 56, 88, 96);
  }

  function overlaps(rects: number[], cx: number, cy: number, size: number) {
    for (let i = 0; i < rects.length; i += 4) {
      if (
        cx < rects[i] + rects[i + 2] &&
        cx + size > rects[i] &&
        cy < rects[i + 1] + rects[i + 3] &&
        cy + size > rects[i + 1]
      )
        return true;
    }
    return false;
  }

  // ¿Toca esta celda (con 2 px de margen por el contorno) alguna zona que se repinta?
  const touchesDirty = (cell: Cell) => {
    const cx = cell.x * CELL - 2;
    const cy = cell.y * CELL - 2;
    return overlaps(dirtyPrev, cx, cy, CELL + 4) || overlaps(dirtyCur, cx, cy, CELL + 4);
  };

  // Restaura el fondo de cada zona y la añade al recorte activo
  function restoreRects(context: CanvasRenderingContext2D, rects: number[]) {
    for (let i = 0; i < rects.length; i += 4) {
      const x = rects[i];
      const y = rects[i + 1];
      const w = rects[i + 2];
      const h = rects[i + 3];
      context.rect(x, y, w, h);
      context.drawImage(background, x, y, w, h, x, y, w, h);
    }
  }

  function draw() {
    if (!ctx) return;
    const overlay = state === "gameover" || paused;

    if (fullRedraw || overlay) {
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
      fullRedraw = overlay; // con overlay siguen los repintados completos (la moneda anima debajo)
      collectAnimatedRects(dirtyCur);
      [dirtyPrev, dirtyCur] = [dirtyCur, dirtyPrev];
      return;
    }

    // Entre pasos: restaura el fondo y repinta solo las zonas animadas (actuales y del frame anterior)
    collectAnimatedRects(dirtyCur);
    ctx.save();
    ctx.beginPath();
    restoreRects(ctx, dirtyPrev);
    restoreRects(ctx, dirtyCur);
    ctx.clip();
    if (food) drawCoin(ctx, food, time);
    drawSnake(ctx, snake, dir, touchesDirty);
    for (const effect of effects) drawEatEffect(ctx, effect);
    ctx.restore();
    [dirtyPrev, dirtyCur] = [dirtyCur, dirtyPrev];
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
