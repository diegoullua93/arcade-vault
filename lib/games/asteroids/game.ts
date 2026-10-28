import type { GameCallbacks, GameHud, GameInstance } from "../types";
import {
  H,
  POINTS,
  POWERUP_DROP_CHANCE,
  POWERUP_DURATION,
  W,
} from "./constants";
import {
  Asteroid,
  Bullet,
  Particle,
  PowerUp,
  Ship,
  type Keys,
} from "./entities";
import { dist, rand } from "./utils";

type State = "playing" | "dead" | "gameover";

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameInstance {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { pause() {}, resume() {}, restart() {}, destroy() {} };
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  const keys: Keys = {};
  const justPressed: Keys = {};

  const BLOCKED_KEYS = [
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Space",
  ];

  const onKeyDown = (e: KeyboardEvent) => {
    if (BLOCKED_KEYS.includes(e.code)) e.preventDefault();

    if (e.code === "KeyP" || e.code === "Escape") {
      if (!e.repeat) (paused ? resume : pause)();
      return;
    }

    if (!keys[e.code] && !paused) justPressed[e.code] = true;
    keys[e.code] = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };

  function pressed(code: string) {
    const val = justPressed[code];
    justPressed[code] = false;
    return val;
  }

  // ── Estado del juego ────────────────────────────────────────────────────────
  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let powerUps: PowerUp[] = [];
  let score = 0;
  let lives = 3;
  let level = 1;
  let state: State = "playing";
  let deadTimer = 0;
  let powerUpSpawned = false;
  let killsSinceSpawn = 0;

  // La pausa no toca `state`: al reanudar se vuelve a playing o dead
  let paused = false;
  let lastTime: number | null = null;
  let rafId = 0;
  let lastHud: GameHud | null = null;

  function emitHud() {
    const hud: GameHud = {
      score,
      lives,
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

  function spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    spawnAsteroids(4);
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
    spawnAsteroids(3 + level);
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives--;
    if (lives <= 0) {
      state = "gameover";
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (state === "gameover") {
      if (pressed("Space")) initGame();
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    // Disparar
    if (pressed("Space")) {
      bullets.push(...ship.tryShoot());
    }

    ship.update(dt, keys);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);

    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!powerUpSpawned) {
            killsSinceSpawn++;
            const guaranteed = killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              powerUps.push(new PowerUp(a.x, a.y));
              powerUpSpawned = true;
            }
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Nave vs asteroide
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    // Nivel completado
    if (asteroids.length === 0) nextLevel();
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  function drawOverlay(title: string, sub: string) {
    if (!ctx) return;
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 46px monospace";
    ctx.fillText(title, W / 2, H / 2 - 18);
    ctx.font = "18px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText(sub, W / 2, H / 2 + 22);
  }

  function draw() {
    if (!ctx) return;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw(ctx));
    asteroids.forEach((a) => a.draw(ctx));
    powerUps.forEach((p) => p.draw(ctx));
    bullets.forEach((b) => b.draw(ctx));
    ship.draw(ctx);

    // El resto del HUD vive en React; aquí solo el contador que cambia cada frame
    ctx.textBaseline = "alphabetic";
    if (ship.tripleShot > 0) {
      ctx.font = "15px monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = "#0ff";
      ctx.fillText(`3x  ${ship.tripleShot.toFixed(1)}s`, 14, 26);
    }

    if (state === "gameover") {
      drawOverlay("GAME OVER", `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
    }

    if (paused) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, W, H);
      drawOverlay("PAUSA", "P / ESC PARA CONTINUAR");
    }
  }

  // ── Loop principal ──────────────────────────────────────────────────────────
  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
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
    if (paused) return;
    paused = true;
    cancelAnimationFrame(rafId);
    draw(); // un último frame con el overlay
    emitHud();
  }

  function resume() {
    if (!paused) return;
    paused = false;
    justPressed["Space"] = false;
    emitHud();
    startLoop();
  }

  const onBlur = () => {
    // Se pierden los keyup mientras la ventana no tiene foco
    for (const code of Object.keys(keys)) keys[code] = false;
    pause();
  };
  const onVisibilityChange = () => {
    if (document.hidden) pause();
  };

  initGame();
  emitHud();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibilityChange);
  startLoop();

  return {
    pause,
    resume,
    restart() {
      initGame();
      paused = false;
      emitHud();
      startLoop();
    },
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}
