# SPEC 05 — Juego ASTEROIDS jugable en Next.js

> **Status:** approved
> **Depends on:** SPEC 01
> **Date:** 2026-10-27
> **Objective:** Portar el juego de `references/02-asteroids` a un módulo TypeScript y montarlo en `/juegos/asteroids/jugar` como Client Component, con el HUD React existente, pausa y sin guardar puntuaciones.

---

## Por qué existe este spec

El SPEC 01 dejó `/juegos/[id]/jugar` con un marco CRT y el texto "JUEGO PRÓXIMAMENTE", y delegó los juegos a un spec posterior. `references/02-asteroids` es un clon completo en canvas (`game.js`, 510 líneas) escrito con globals, un `<canvas id="canvas">` fijo y listeners de teclado que nunca se retiran. Eso no funciona tal cual en el App Router: el componente se monta y desmonta, React 19 ejecuta los efectos dos veces en desarrollo y las flechas y Espacio desplazan la página.

Este spec es el primer juego real. Su estructura (módulo de motor + componente de pantalla) debe poder reutilizarla Tetris (`references/03-tetris`) y Arkanoid (`references/04-arkanoid`), pero esos juegos no se tocan aquí.

Archivos de referencia en `references/02-asteroids/`:

| Archivo      | Contenido relevante                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `game.js`    | Clases `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`; estado global; `update(dt)`, `draw()` y loop con `requestAnimationFrame` |
| `CLAUDE.md`  | Resumen de arquitectura: tamaños 1/2/3, `wrap` toroidal, canvas fijo 800×600, colisión círculo-círculo con factor 0.82 para la nave  |
| `README.md`  | Controles y tabla de puntos (grande 20, mediano 50, pequeño 100)                                                                     |
| `index.html` | Solo el `<canvas>` 800×600; no se porta                                                                                              |

## Scope

**In:**

- Motor del juego en TypeScript, sin dependencias de React, en `lib/games/asteroids/`, portando la lógica de `game.js` sin cambiar reglas ni números: nave con inercia, balas con TTL, asteroides de tamaño 3→2→1 con polígono irregular, partículas, powerup de triple disparo (`3x`), 3 vidas, invencibilidad de 3 s al reaparecer, niveles con `3 + level` asteroides y envolvimiento toroidal.
- API del motor: `createAsteroidsGame(canvas, callbacks)` que devuelve un objeto con `pause()`, `resume()`, `restart()` y `destroy()`.
- Client Component `components/game/game-screen.tsx` que renderiza el HUD, el marco CRT y el `<canvas>` 800×600, crea el motor en `useEffect` y lo destruye al desmontar.
- HUD React: los campos Jugador, Puntuación, Vidas y Nivel del `.player-hud` existente muestran valores reales del juego, actualizados por callback solo cuando cambian.
- Canvas con la escena, el overlay `GAME OVER` (con puntaje y "ESPACIO PARA REINICIAR"), el overlay `PAUSA` y el indicador `3x  N.Ns` del powerup activo.
- Pausa con `P` o `Escape`, y pausa automática al perder foco la ventana o ocultarse la pestaña.
- `preventDefault` sobre flechas y `Espacio` mientras el juego está montado, para que la página no se desplace.
- Canvas escalado por CSS manteniendo 4:3, sin cambiar la resolución interna. El marco CRT se limita por ancho disponible y por altura del viewport (`100dvh`), para que la pantalla completa quepa sin zoom del navegador ni scroll vertical en una notebook estándar.
- `app/juegos/[id]/jugar/page.tsx` renderiza `GameScreen` para `asteroids`; el resto de ids mantiene el placeholder actual.
- Renombrar la entrada del catálogo: en `lib/games.ts`, `id: "rocas"` → `"asteroids"`, `title: "ROCAS"` → `"ASTEROIDS"` y `cover: "cover-rocas"` → `"cover-asteroids"`; en `app/globals.css`, selectores `.cover-rocas` → `.cover-asteroids`; en `lib/home.ts`, la actividad `game: "Rocas"` → `"Asteroids"`.
- Nota breve en `CLAUDE.md` (Architecture notes) sobre `lib/games/` y el patrón del motor.
- Diseño de la parte visual nueva (overlay de pausa, escalado, estados del marco) con la skill `/frontend-design`, como exige `CLAUDE.md`.

**Out of scope (para specs futuros):**

- Guardar puntuaciones: ni Supabase, ni `localStorage`, ni récord personal. `GAME OVER` muestra el puntaje y nada más.
- Ranking real: `seededScores` y `best` / `plays` de `lib/games.ts` siguen siendo mock.
- Auth y vincular la partida al usuario; el nombre sigue saliendo de `PlayerName` (sesión mock).
- Controles táctiles o gamepad.
- OVNIs, mencionados en `lib/games.ts` (`long`) pero que `game.js` no implementa; el texto no se cambia.
- Sonido y música.
- Pantalla de inicio o menú previo a la partida; el juego arranca al montar, igual que la referencia.
- Portar Tetris y Arkanoid.
- Tests automatizados: el repo no tiene test runner; la validación es manual.
- Modificar los archivos de `references/`.

## Data model

Sin tablas ni persistencia. El estado vive en memoria dentro del motor y solo un resumen sale hacia React.

```ts
// lib/games/types.ts
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
```

```ts
// lib/games/asteroids/game.ts
export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameInstance;
```

```ts
// lib/games.ts  (añadir)
export const PLAYABLE_GAME_IDS: readonly string[] = ["asteroids"];
```

Estructura de archivos del motor:

| Archivo                            | Contenido                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `lib/games/types.ts`               | Tipos anteriores, compartidos por futuros juegos                                                      |
| `lib/games/asteroids/constants.ts` | `W = 800`, `H = 600`, `RADII`, `SPEEDS`, `POINTS`, constantes de powerup                              |
| `lib/games/asteroids/utils.ts`     | `wrap`, `dist`, `rand`, `randInt`                                                                     |
| `lib/games/asteroids/entities.ts`  | `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`; reciben `ctx` e input por parámetro, sin globals |
| `lib/games/asteroids/game.ts`      | Estado, `update(dt)`, `draw()`, loop, input, pausa y `createAsteroidsGame`                            |

Convenciones:

- Las constantes numéricas (`RADII = [0, 16, 30, 50]`, `SPEEDS = [0, 85, 55, 32]`, `POINTS = [0, 100, 50, 20]`, `THRUST = 260`, `DRAG = 0.987`, `ROT = 3.5`, cooldown 0.2 s, bala 520 px/s con TTL 1.1 s) se copian de `game.js` sin cambios.
- Todo el estado es local a la clausura de `createAsteroidsGame`; no hay variables de módulo mutables. Dos instancias no comparten nada.
- `dt` se limita a 50 ms. Al reanudar tras una pausa, `lastTime` se reinicia para que el primer `dt` sea 0.
- `Math.random` y `performance.now` se usan solo dentro del motor (se ejecuta en `useEffect`), nunca durante el render de React; evita hydration mismatch.
- El HUD no se emite en cada frame: se compara con el último valor emitido.
- El estado `paused` no pierde el estado previo (`playing` o `dead`): al reanudar vuelve a él.
- Teclas: `ArrowLeft` / `ArrowRight` rotan, `ArrowUp` propulsa, `Space` dispara (y reinicia en `gameover`), `KeyP` / `Escape` alternan pausa.

## Implementation plan

Antes de empezar: leer en `node_modules/next/dist/docs/` lo relativo a Client Components y a `useEffect` con `cacheComponents`, y la sección de `PageProps` / rutas dinámicas (ver `CLAUDE.md`). Invocar `/frontend-design` antes del paso 7.

1. **Renombrar en el catálogo.** Aplicar el renombrado de `rocas` a `asteroids` en `lib/games.ts`, `app/globals.css` y `lib/home.ts`, y confirmar con `git grep -n -i "rocas"` que no quedan referencias (salvo la palabra "rocas" en el texto `long` del catálogo). Verificar: `npm run build` pasa y `/juegos/asteroids` muestra el detalle con título ASTEROIDS y la portada.
2. **Tipos y utilidades.** Crear `lib/games/types.ts`, `lib/games/asteroids/constants.ts` y `lib/games/asteroids/utils.ts`. Verificar: `npx tsc --noEmit` pasa.
3. **Entidades.** Crear `lib/games/asteroids/entities.ts` portando `Bullet`, `Asteroid`, `PowerUp`, `Ship` y `Particle`. Cada clase recibe `ctx` en `draw(ctx)` y la nave recibe el objeto de teclas en `update(dt, keys)`. Verificar: `npx tsc --noEmit` y `npm run lint` pasan.
4. **Motor.** Crear `lib/games/asteroids/game.ts` con `createAsteroidsGame`: estado en clausura, `initGame`, `nextLevel`, `killShip`, `update`, `draw` (sin HUD de texto salvo `3x  N.Ns`, y con overlay `GAME OVER`), loop con `requestAnimationFrame`, listeners de teclado en `window`, `onHudChange` y `destroy()`. Verificar: `npx tsc --noEmit` y `npm run lint` pasan.
5. **Pausa, foco y scroll.** Añadir al motor `pause` / `resume`, las teclas `P` / `Escape`, el overlay `PAUSA`, pausa automática con `blur` de la ventana y `visibilitychange`, y `preventDefault` sobre flechas y `Espacio`. Verificar: `npx tsc --noEmit` y `npm run lint` pasan.
6. **Componente de pantalla.** Crear `components/game/game-screen.tsx` (`"use client"`): `useRef` del canvas, `useEffect` que llama a `createAsteroidsGame` y devuelve `destroy`, `useState<GameHud>` actualizado desde `onHudChange`. Mover aquí el `.player-hud` (Jugador con `<PlayerName />`, Puntuación, Vidas como corazones y Nivel con dos dígitos) y el marco `.crt` con el `<canvas width={800} height={600}>` escalado a `width: 100%`. Mantener el botón SALIR hacia `/juegos/[id]`. Verificar: `npm run build` pasa.
7. **Integración en la ruta.** Añadir `PLAYABLE_GAME_IDS` a `lib/games.ts` y hacer que `app/juegos/[id]/jugar/page.tsx` renderice `<GameScreen gameId=... />` para los ids jugables y conserve el placeholder para el resto. Aplicar `/frontend-design` al overlay de pausa y al escalado del canvas; añadir los estilos nuevos a `app/globals.css` con prefijo `av-` en cualquier `@keyframes`. Verificar: `/juegos/asteroids/jugar` muestra el juego y `/juegos/caida/jugar` sigue mostrando "JUEGO PRÓXIMAMENTE".
8. **Documentar.** Añadir a `CLAUDE.md`, en Architecture notes, un punto con `lib/games/` (motor sin React, `createXGame(canvas, callbacks)` que devuelve `destroy`) y `components/game/game-screen.tsx`. Verificar: `git diff` de `CLAUDE.md` muestra solo esa adición.

## Acceptance criteria

**Build**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores y generan `/juegos/[id]/jugar`.
- [ ] `lib/games/asteroids/` no importa `react` ni `next/*`.
- [ ] No hay variables mutables a nivel de módulo en `lib/games/asteroids/` (`git grep -nE "^let |^var " -- lib/games` no devuelve resultados).
- [ ] No se modifica ningún archivo de `references/`.

**Integración**

- [ ] `git grep -n -i "rocas" -- app lib components` no devuelve resultados salvo la palabra "rocas" del texto `long` del catálogo, y la tarjeta del juego muestra el título ASTEROIDS.
- [ ] `/juegos/asteroids/jugar` muestra un canvas con la nave en el centro y al menos 4 asteroides, dentro del marco CRT.
- [ ] `/juegos/caida/jugar` (y los demás ids no jugables) siguen mostrando "JUEGO PRÓXIMAMENTE".
- [ ] `/juegos/inexistente/jugar` devuelve la página 404.
- [ ] SALIR navega a `/juegos/asteroids`.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/juegos/asteroids/jugar`.

**Jugabilidad (manual)**

- [ ] `←` y `→` rotan la nave; `↑` la propulsa y muestra la llama; sin pulsar nada la nave se frena por inercia.
- [ ] `Espacio` dispara una bala; no se puede disparar más de una vez cada 0,2 s.
- [ ] Un asteroide grande destruido suma 20 puntos y se parte en dos medianos; un mediano suma 50 y da dos pequeños; un pequeño suma 100 y no se parte.
- [ ] Nave, balas y asteroides reaparecen por el lado opuesto al salir del canvas.
- [ ] Chocar con un asteroide con la invencibilidad agotada resta una vida y muestra la explosión; la nave reaparece al centro a los 2 s parpadeando durante 3 s, sin morir en ese lapso.
- [ ] Al destruir todos los asteroides el nivel sube en 1 y aparecen `3 + nivel` asteroides.
- [ ] Al recoger el powerup `3x` los disparos salen en abanico de 3 balas y el canvas muestra `3x  N.Ns` descontando hasta 0.
- [ ] Al perder la tercera vida el canvas muestra `GAME OVER` con el puntaje y "ESPACIO PARA REINICIAR"; `Espacio` reinicia con puntuación 0, 3 vidas y nivel 1.

**HUD React**

- [ ] Puntuación, Vidas y Nivel del `.player-hud` coinciden con el estado del juego y cambian al sumar puntos, perder una vida y subir de nivel.
- [ ] El Nivel se muestra con dos dígitos (`01`) y las vidas como corazones, igual que el placeholder del SPEC 01.
- [ ] Jugador muestra el nombre de la sesión mock o `INVITADO`.
- [ ] El HUD no provoca un re-render por frame: con el juego en marcha, `onHudChange` solo se invoca cuando cambia un campo (comprobable con un `console.count` temporal que se retira antes de cerrar).

**Pausa, foco y teclado**

- [ ] `P` y `Escape` pausan y reanudan; en pausa nada se mueve y el canvas muestra `PAUSA`.
- [ ] Tras reanudar, las entidades no "saltan" (el primer `dt` es 0).
- [ ] Cambiar de pestaña o quitar el foco a la ventana pausa el juego; volver no lo reanuda solo.
- [ ] Con el juego montado, flechas y `Espacio` no desplazan la página.
- [ ] Al salir de la ruta con SALIR o con el botón atrás, ya no se disparan ni se mueven entidades con el teclado, y volver a entrar inicia una partida nueva (`destroy` retira loop y listeners; en desarrollo, el doble efecto de React 19 no duplica la velocidad del juego ni los disparos).

**Visual (manual)**

- [ ] A 1440×900 y a 1366×650 el canvas se ve completo (pantalla y barra inferior del marco) sin scroll vertical, manteniendo 4:3.
- [ ] A 390×844 el canvas no desborda horizontalmente la página y el juego se ve completo (sin controles táctiles; solo teclado).
- [ ] Los overlays `GAME OVER` y `PAUSA` son legibles sobre la escena.

**Sin efectos colaterales**

- [ ] `git status` lista solo `lib/games/`, `lib/games.ts`, `lib/home.ts`, `components/game/`, `app/juegos/[id]/jugar/page.tsx`, `app/globals.css`, `CLAUDE.md` y este spec.
- [ ] Ningún archivo importa `lib/supabase/` ni usa `localStorage` para puntuaciones.

## Decisions

- **Sí:** módulo TypeScript + Client Component. Permite tipado, lint y `destroy()` limpio; el motor sirve de plantilla para Tetris y Arkanoid.
- **No:** `iframe` con `public/asteroids/index.html`. Cero reescritura, pero el juego queda aislado del HUD React y de Supabase en el spec de puntuaciones.
- **No:** `next/script` con `game.js` casi intacto. Conserva globals y listeners sin cleanup, que fallan con montaje doble y con navegación cliente.
- **Sí:** motor sin React, con callbacks (`onHudChange`). Desacopla la lógica del framework y permite portar el patrón a otros juegos.
- **Sí:** HUD en React (`.player-hud` existente) y el canvas solo dibuja la escena. Decisión del usuario; reutiliza el diseño del SPEC 01. Se descarta `drawHUD()` salvo el indicador `3x`, que cambia cada frame y no tiene hueco en el HUD.
- **Sí:** emitir el HUD solo cuando cambia. Evita 60 re-renders por segundo.
- **Sí:** puntuación solo local, sin persistir. Decisión del usuario; guardar requiere tablas, RLS y Auth, que SPEC 04 dejó fuera.
- **No:** récord en `localStorage`. No sirve para el ranking compartido y añadiría una clave versionada que luego habría que migrar.
- **Sí:** pausa con `P` / `Escape`. El SPEC 01 la dejó fuera del reproductor; sale barata con un loop propio.
- **Sí:** pausa automática al perder foco o ocultar la pestaña. En una página web el usuario cambia de pestaña a menudo; sin pausa, la nave muere sin jugar. El reinicio de `lastTime` evita el salto de `dt`.
- **Sí:** `preventDefault` en flechas y `Espacio`. En la referencia no hace falta (la página no tiene scroll); aquí sí.
- **No:** controles táctiles. Amplían el alcance (botones, multitouch, layout móvil); van en su propio spec.
- **Sí:** mantener resolución interna 800×600 y escalar con CSS. Las constantes de física y colisión están en píxeles de ese tamaño; cambiar la resolución cambiaría la jugabilidad.
- **Sí:** copiar constantes y reglas sin retocar. El objetivo es adaptar, no rebalancear; cualquier ajuste va en otro spec.
- **Sí:** `PLAYABLE_GAME_IDS` en `lib/games.ts`. Evita cambiar la página cada vez que se porte un juego nuevo y mantiene el placeholder para los demás.
- **Sí:** renombrar el juego del catálogo de `rocas` / "ROCAS" a `asteroids` / "ASTEROIDS" (id, título, clase de portada y actividad reciente del home). Decisión del usuario: el juego se llama Asteroids. Cambia la URL a `/juegos/asteroids`; no hay enlaces externos que romper porque la app aún no está publicada.
- **No:** corregir el texto "Cuidado con los OVNIs" de `lib/games.ts`. No es parte de este port; se decide al ajustar el contenido del catálogo.
- **Sí:** validación manual. No hay test runner y el valor está en el comportamiento visible; lo comprobable en código se cubre con `tsc`, lint y `git grep`.

## Risks

| Riesgo                                                                                            | Mitigación                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| React 19 ejecuta `useEffect` dos veces en desarrollo y puede duplicar loop y listeners            | `destroy()` cancela `requestAnimationFrame` y retira cada listener con la misma referencia; criterio de aceptación sobre el doble efecto                                       |
| `preventDefault` global en `Espacio` y flechas rompe la navegación por teclado de otros elementos | Los listeners se registran solo mientras `GameScreen` está montado y se retiran al salir; los botones SALIR siguen activables con `Enter`                                      |
| `cacheComponents` cambia la semántica de la ruta dinámica                                         | La página sigue siendo Server Component con `generateStaticParams`; el juego vive solo en el Client Component y no usa APIs de request. Leer la documentación antes del paso 6 |
| Hydration mismatch por aleatoriedad o `performance.now`                                           | Todo el uso de `Math.random` y `performance.now` ocurre dentro del motor, que se crea en `useEffect`, nunca en el render                                                       |
| Re-render del HUD por frame degrada el rendimiento                                                | `onHudChange` compara con el último valor emitido; el estado de React guarda solo `score`, `lives`, `level` y `status`                                                         |
| Comportamiento distinto al original tras la reescritura a clases tipadas                          | Constantes y reglas copiadas sin cambios; checklist de jugabilidad cubre puntos, partición, vidas, niveles y powerup                                                           |
| Colisión nave-asteroide usa el factor 0.82 que depende de `a.radius`                              | Copiar `ship.radius + a.radius * 0.82` literalmente                                                                                                                            |
| Canvas escalado por CSS en pantallas pequeñas deja el juego muy diminuto                          | Aceptado en este spec (solo teclado). La experiencia móvil, con controles táctiles, es otro spec                                                                               |
| `Escape` choca con atajos del navegador o cierra pantalla completa                                | Solo se interpreta cuando el juego está montado; `P` queda como alternativa                                                                                                    |

## What is **not** in this spec

- Guardar puntuaciones (Supabase, `localStorage` o récord personal) ni ranking real.
- Auth o relación de la partida con un usuario.
- Controles táctiles, gamepad, sonido o música.
- OVNIs ni cambios de balance o reglas respecto de `references/02-asteroids`.
- Pantalla de inicio o menú previo a la partida.
- Tetris y Arkanoid.
- Tests automatizados.
- Cambios a los archivos de `references/`.

Cada uno de estos puntos, si se aborda, va en su propio spec.
