import type { GameCallbacks, GameHud, GameInstance, GameOptions } from "../types";
import {
  BLOCK,
  COLS,
  DROP_STEP,
  INITIAL_DROP_INTERVAL,
  KICKS,
  LINES_PER_LEVEL,
  LINE_SCORES,
  MIN_DROP_INTERVAL,
  ROWS,
} from "./constants";
import { randomPiece, type Piece } from "./entities";
import { getSkin } from "./skins";
import { createBoard, rotateCW } from "./utils";

type State = "playing" | "gameover";

export function createTetrisGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
  options: GameOptions = {},
): GameInstance {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { pause() {}, resume() {}, restart() {}, destroy() {} };
  }

  // Capa de dibujo: la simulación de abajo no depende del skin
  const skin = getSkin(options.skin);

  // ── Estado del juego ────────────────────────────────────────────────────────
  let board = createBoard();
  let current: Piece = randomPiece();
  let next: Piece = randomPiece();
  let score = 0;
  let lines = 0;
  let level = 1;
  let state: State = "playing";
  let dropInterval = INITIAL_DROP_INTERVAL;
  let dropAccum = 0;

  let paused = false;
  let lastTime: number | null = null;
  let rafId = 0;
  let lastHud: GameHud | null = null;

  function emitHud() {
    const hud: GameHud = {
      score,
      lives: 0, // Tetris no tiene vidas; GameScreen oculta la casilla
      level,
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

  // ── Lógica del tablero ──────────────────────────────────────────────────────
  function collide(shape: number[][], ox: number, oy: number) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    for (const kick of KICKS) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c]) board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    // Filas completas antes de colapsar, solo para los efectos visuales del skin
    const fullRows: number[] = [];
    board.forEach((row, r) => {
      if (row.every((v) => v !== 0)) fullRows.push(r);
    });
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      const gained = (LINE_SCORES[cleared] || 0) * level;
      score += gained;
      skin.onLinesCleared(fullRows, gained);
      level = Math.floor(lines / LINES_PER_LEVEL) + 1;
      dropInterval = Math.max(MIN_DROP_INTERVAL, INITIAL_DROP_INTERVAL - (level - 1) * DROP_STEP);
    }
  }

  function ghostY() {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function spawn() {
    current = next;
    next = randomPiece();
    callbacks.onNextChange?.(next.shape);
    if (collide(current.shape, current.x, current.y)) state = "gameover";
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }

  function initGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    state = "playing";
    dropInterval = INITIAL_DROP_INTERVAL;
    dropAccum = 0;
    skin.resetEffects();
    next = randomPiece();
    spawn();
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  const BLOCKED_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"];

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

    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
    emitHud();
  };

  // ── Update ──────────────────────────────────────────────────────────────────
  function update(dtMs: number) {
    skin.updateEffects(dtMs);
    if (state === "gameover") return;
    dropAccum += dtMs;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) current.y++;
      else lockPiece();
    }
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  function draw() {
    if (!ctx) return;
    skin.drawBackground(ctx);

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) skin.drawBlock(ctx, c, r, board[r][c], BLOCK);

    // Pieza fantasma
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          skin.drawGhost(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK);

    // Pieza actual
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        skin.drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

    skin.drawEffects(ctx);

    if (state === "gameover") {
      skin.drawOverlay(ctx, "GAME OVER", [`PUNTAJE: ${score}`, "ESPACIO PARA REINICIAR"], false);
    }

    if (paused) {
      skin.drawOverlay(ctx, "PAUSA", ["P / ESC PARA CONTINUAR"], true);
    }
  }

  // ── Loop principal ──────────────────────────────────────────────────────────
  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;
    update(dt);
    draw();
    emitHud();
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    cancelAnimationFrame(rafId);
    lastTime = null; // el primer dt tras reanudar es 0
    rafId = requestAnimationFrame(loop);
  }

  function pause() {
    // En gameover no hay nada que pausar: el overlay GAME OVER se queda
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
    initGame();
    paused = false;
    emitHud();
    startLoop();
  }

  const onBlur = () => pause();
  const onVisibilityChange = () => {
    if (document.hidden) pause();
  };

  initGame();
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
