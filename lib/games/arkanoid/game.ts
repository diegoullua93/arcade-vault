import type { GameCallbacks, GameHud, GameInstance, GameOptions } from "../types";
import {
  BALL_SIZE,
  BASE_BALL_VX,
  BASE_BALL_VY,
  BLOCKS_ORIGIN_X,
  BLOCKS_ORIGIN_Y,
  BLOCK_H,
  BLOCK_W,
  EXPLOSION_DURATION,
  H,
  INITIAL_LIVES,
  PADDLE_BOUNCE_MARGIN,
  PADDLE_H,
  PADDLE_SPEED,
  PADDLE_W,
  PADDLE_Y,
  POINTS_PER_BLOCK,
  W,
} from "./constants";
import type { Ball, Block, Explosion, Paddle } from "./entities";
import { LEVELS } from "./levels";
import { getSkin } from "./skins";
import { collideAABB } from "./utils";

type State = "playing" | "gameover";

export function createArkanoidGame(
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
  const paddle: Paddle = { x: 0, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H };
  const ball: Ball = { x: 0, y: 0, w: BALL_SIZE, h: BALL_SIZE, vx: BASE_BALL_VX, vy: BASE_BALL_VY };
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let lives = INITIAL_LIVES;
  let score = 0;
  let currentLevel = 1;
  let state: State = "playing";
  let won = false; // gameover por completar el último nivel
  const keys = { left: false, right: false };

  let paused = false;
  let destroyed = false;
  let ready = false; // el skin ya tiene sus assets cargados
  let lastTime: number | null = null;
  let rafId = 0;
  let lastHud: GameHud | null = null;

  function emitHud() {
    const hud: GameHud = {
      score,
      lives,
      level: currentLevel,
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
  function initPaddle() {
    paddle.x = (W - paddle.w) / 2;
  }

  function initBall() {
    const speed = LEVELS[currentLevel - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    currentLevel = n;
    blocks = LEVELS[n - 1].blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    initBall();
  }

  function initGame() {
    score = 0;
    lives = INITIAL_LIVES;
    state = "playing";
    won = false;
    initPaddle();
    loadLevel(1);
    skin.resetEffects();
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

    if (e.code === "ArrowLeft") keys.left = true;
    if (e.code === "ArrowRight") keys.right = true;
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft") keys.left = false;
    if (e.code === "ArrowRight") keys.right = false;
  };

  const onMouseMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (W / rect.width);
    paddle.x = Math.max(0, Math.min(W - paddle.w, mouseX - paddle.w / 2));
  };

  // ── Update ──────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (state !== "playing") return;

    // Paleta
    if (keys.left) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys.right) paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    // Pelota
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Rebotes en paredes (izquierda, derecha, techo)
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
    }

    // Rebote en la paleta
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + PADDLE_BOUNCE_MARGIN
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
    }

    // Colisión con bloques (uno por frame)
    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(ball, block)) {
        block.alive = false;
        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        score += POINTS_PER_BLOCK;
        skin.onBlockHit(block, POINTS_PER_BLOCK);
        ball.vy = -ball.vy;
        if (blocks.every((b) => !b.alive)) {
          if (currentLevel < LEVELS.length) loadLevel(currentLevel + 1);
          else {
            state = "gameover";
            won = true;
          }
        }
        break;
      }
    }

    // Explosiones
    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    // Pelota perdida
    if (ball.y > H) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        state = "gameover";
        won = false;
      } else {
        initBall();
      }
    }
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  function draw() {
    if (!ctx || !ready) return;
    skin.drawBackground(ctx);

    for (const block of blocks) if (block.alive) skin.drawBlock(ctx, block);
    for (const exp of explosions)
      skin.drawExplosion(ctx, exp, Math.min(exp.elapsed / EXPLOSION_DURATION, 1));

    skin.drawPaddle(ctx, paddle);
    skin.drawBall(ctx, ball);
    skin.drawEffects(ctx);

    if (state === "gameover") {
      const sub = [`PUNTAJE: ${score}`, "ESPACIO PARA REINICIAR"];
      skin.drawOverlay(ctx, won ? "¡COMPLETASTE EL JUEGO!" : "GAME OVER", sub);
    }

    if (paused) skin.drawOverlay(ctx, "PAUSA", ["P / ESC PARA CONTINUAR"]);
  }

  // ── Loop principal ──────────────────────────────────────────────────────────
  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50) / 1000;
    lastTime = ts;
    update(dt);
    skin.updateEffects(dt * 1000);
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
    initGame();
    paused = false;
    emitHud();
    if (ready) startLoop();
  }

  const onBlur = () => {
    keys.left = false;
    keys.right = false;
    pause();
  };
  const onVisibilityChange = () => {
    if (document.hidden) pause();
  };

  // ── Arranque: el loop empieza cuando el skin tiene sus assets (el clásico carga
  // el spritesheet; neón y mario están listos al instante) ─────────────────────
  initGame();
  emitHud();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibilityChange);
  canvas.addEventListener("mousemove", onMouseMove);

  const abortLoad = skin.load(() => {
    if (destroyed) return;
    ready = true;
    if (paused) draw();
    else startLoop();
  });

  return {
    pause,
    resume,
    restart,
    destroy() {
      destroyed = true;
      abortLoad();
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("mousemove", onMouseMove);
    },
  };
}
