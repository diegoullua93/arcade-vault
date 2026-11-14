# GAME JAM «Ping-pong» — Juego DUELO PIXEL jugable con leaderboard

> **Status:** draft
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 08, SPEC 09
> **Date:** 2026-11-03
> **Theme:** ping-pong
> **Objective:** Crear `duelo-pixel` como motor TypeScript en `lib/games/duelo-pixel/` (duelo de paletas contra una escalera de 5 rivales CPU con efecto en la pelota), montarlo en `/juegos/duelo-pixel/jugar` (canvas 800×600), activar su fila del catálogo y guardar su puntuación en el leaderboard existente.

---

## Por qué existe este spec

DUELO PIXEL es la interpretación más directa del tema «ping-pong»: dos paletas verticales, una red central y una pelota luminosa. Para que tenga sentido en un leaderboard de un solo jugador, la partida es una **liga en escalera**: el jugador se enfrenta a 5 rivales CPU, cada uno más rápido y certero. Los partidos son a 7 puntos, perder uno termina la partida y ganar los 5 es la victoria. La puntuación premia ganar puntos, hacer peloteos largos y ganar partidos con diferencia.

Como en Serpentina (SPEC 09), es un juego **desde cero**: no hay carpeta en `references/` y las reglas las fija este spec. Reutiliza el patrón de los SPEC 05–09: un motor sin React en `lib/games/<id>/`, `GameScreen` parametrizado con `GAMES_CONFIG` (SPEC 07) y el catálogo y `saveScore` genéricos por `game_id` (SPEC 06).

Lo que distingue a DUELO PIXEL de los juegos ya jugables:

- **Hay un rival con IA**, no un muro de bloques como en Arkanoid. La pelota sale por los dos lados y cada punto lo gana alguien. La CPU **predice** dónde llegará la pelota con un retraso de reacción y un error propios de cada rival.
- **El efecto es la mecánica clave.** Si la pala del jugador se mueve al golpear, la pelota curva su trayectoria durante 500 ms. La predicción de la CPU **ignora el efecto**, así que curvar la pelota es la forma de superar a los rivales rápidos. Arkanoid no tiene nada equivalente.
- **El ángulo de salida depende del punto de impacto** en la pala (hasta ±60°), y la velocidad sube con cada golpe dentro del peloteo.
- **Sin vidas**: un partido perdido es GAME OVER. El HUD oculta Vidas (`showLives: false`, como Tetris y Serpentina) y Nivel muestra el número de rival (`01`–`05`).
- La fila `duelo-pixel` **ya existe** en `games`: no es jugable, usa `cover-duelo`, color `cyan`, categoría `VERSUS`, `sort_order` 8, y tiene 10 filas `is_seed` (49 186–226 480). Este spec borra esas semillas y actualiza su texto `long`, que hoy promete un modo a dos jugadores.

Análisis de la fuente (juego nuevo, reglas cerradas con el usuario):

| Aspecto             | Resultado                                                                                                                                                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivos útiles     | Ninguno: no existe referencia. Se escribe `lib/games/duelo-pixel/` desde cero. La portada `cover-duelo` (`app/globals.css`) fija la paleta: pala izquierda cyan, pala derecha magenta, pelota amarilla y red discontinua                                                                          |
| Globals y listeners | Estado en la clausura (`player`, `cpu`, `ball`, `rivalIndex`, `playerPoints`, `cpuPoints`, `rallyHits`, `score`, `phase`, `phaseTimer`, `status`, `keys`, `lastTime`). `keydown`/`keyup` en `window`, `blur` en `window` y `visibilitychange` en `document`, todos retirados en `destroy`          |
| Canvas              | 800×600 interno. Bandas de pared de 8 px arriba y abajo; palas de 12×90 px a 32 px de cada borde lateral; pelota cuadrada de 12 px                                                                                                                                                              |
| HUD y overlays      | Puntuación y Nivel (= rival) van al HUD de React; Vidas se oculta. El marcador del partido, el nombre del rival y los overlays `PAUSA`, `¡VENCISTE A <RIVAL>!`, `GAME OVER` y `¡CAMPEÓN DEL DUELO!` se dibujan en el canvas                                                                     |
| Puntuación          | Cada punto ganado suma `100 × rival + 10 × min(golpes del peloteo, 30)`. Cada partido ganado suma `1 000 × rival × (puntos del jugador − puntos de la CPU)`. El máximo plausible es 126 000                                                                                                    |
| Estados             | `playing`, `paused` y `gameover` (partido perdido o liga completa). Sin vidas y sin `dead`. Las fases internas (`serve`, `rally`, `point`, `matchWon`) no salen del motor                                                                                                                         |
| Controles           | `↑` / `↓` mueven la pala; `P` / `Escape` pausan; `Espacio` reinicia en `gameover`                                                                                                                                                                                                               |
| Assets              | Ninguno: todo se dibuja con primitivas de canvas                                                                                                                                                                                                                                                |
| Discrepancias       | El `long` del catálogo promete «Modo solitario contra la CPU o partida local a dos jugadores» y el juego no tiene modo a dos jugadores. Una migración reescribe el `long` (ver Decisions). Las semillas (hasta 226 480) superan el máximo plausible (126 000) y se borran                         |

## Scope

**In:**

- Motor en `lib/games/duelo-pixel/` (`constants.ts`, `utils.ts`, `entities.ts`, `rivals.ts`, `draw.ts`, `game.ts`) con `createDueloPixelGame(canvas, callbacks)` → `{ pause, resume, restart, destroy }`.
- Reglas:
  - Pista de 800×600 con paredes de 8 px arriba y abajo, donde la pelota rebota. Los laterales están abiertos: si la pelota sale por la izquierda, punto para la CPU; si sale por la derecha, punto para el jugador.
  - El jugador lleva la pala izquierda (cyan) y la CPU la derecha (magenta).
  - Partidos a 7 puntos, sin ventaja: gana el primero que llega a 7.
- Escalera de 5 rivales (`CHISPA`, `ECO`, `VOLTIO`, `PRISMA`, `NÉMESIS`), cada uno con su velocidad de pala, intervalo de reacción, error de puntería y velocidad de saque (tabla en Data model).
  - Perder un partido emite `gameover` con el overlay `GAME OVER`.
  - Ganar un partido muestra durante 2 200 ms el interludio `¡VENCISTE A <RIVAL>!` con el bonus de partido, y luego empieza el siguiente.
  - Ganar al rival 5 emite `gameover` con el overlay `¡CAMPEÓN DEL DUELO!`.
- Física:
  - El ángulo de salida es proporcional al punto de impacto en la pala (máximo ±60°).
  - La velocidad sube 20 px/s por golpe de pala, hasta un tope de 840 px/s.
  - **Efecto**: si la pala del jugador se mueve al golpear, la pelota recibe una aceleración vertical de 700 px/s² en el sentido del movimiento durante 500 ms. Un rebote en la pared lo anula.
  - Detección por subpasos (≤ 6 px por subpaso) para que la pelota no atraviese las palas.
- IA de la CPU: recalcula su objetivo cada `reactionMs` del rival. Predice la `y` de llegada con rebotes en las paredes **sin tener en cuenta el efecto** y le suma un error aleatorio fijo para cada trayecto. Cuando la pelota se aleja, vuelve al centro al 50 % de su velocidad.
- Saque: la pelota aparece en el centro tras 900 ms, con un ángulo aleatorio de ±30° y la velocidad de saque del rival.
  - El primer saque de cada partido va hacia la CPU.
  - Después de cada punto, saca hacia quien lo perdió.
- Puntuación:
  - Cada punto ganado por el jugador suma `100 × rival + 10 × min(golpes, 30)`. `golpes` cuenta los golpes de pala de ambos lados en ese peloteo.
  - Cada partido ganado suma `1 000 × rival × (puntos del jugador − puntos de la CPU)`.
  - Los puntos de la CPU no restan.
- Canvas 800×600, sin cambios de dimensiones en `GameScreen`. Solo se añade la entrada de `duelo-pixel` en `GAMES_CONFIG`, con `showLives: false` y `showNext: false`.
- HUD de React: Jugador, Puntuación y Nivel (rival `01`–`05`), sin Vidas. El motor emite `lives: 0` y `level = rival`.
- Pausa con `P` / `Escape`, al perder el foco (`blur`) y al cambiar de pestaña (`visibilitychange`), con overlay `PAUSA`. `preventDefault` sobre flechas y `Espacio`. `Espacio` reinicia en `gameover` (solo en la pulsación inicial, `!e.repeat`).
- Registro en `GAMES_CONFIG` (`components/game/game-screen.tsx`) y en `PLAYABLE_GAME_IDS` (`lib/games.ts`).
- Migración `supabase/migrations/20261103120000_activate_duelo_pixel.sql`: borra las 10 filas `is_seed` de `duelo-pixel` y actualiza el `long` de su fila en `games`. Título, `short`, categoría, portada, color y `sort_order` no cambian.
- Guardado automático de la puntuación en GAME OVER y en victoria con el `saveScore` existente, sin código de leaderboard nuevo.
- Estilo CRT neón de la plataforma, dibujado en canvas (sección _Dirección visual_). Se diseña con `/frontend-design`, como exige `CLAUDE.md`.
- Actualizar `CLAUDE.md` (Architecture notes) y `references/JUEGOS.md` (tabla y sección del juego, sacar `duelo-pixel` de «aún no jugables»).

**Out of scope (para specs futuros):**

- Modo a 2 jugadores en local o en línea, y menú de selección de modo.
- Efecto en los golpes de la CPU, power-ups, varias pelotas u obstáculos en la pista.
- Selector de dificultad o de rival, y guardar el progreso de la liga entre partidas.
- Sonido y música.
- Controles táctiles, ratón, gamepad o teclas `W` / `S`.
- Cambiar el título, el `short`, la portada `cover-duelo` o el color del catálogo.
- Auth, anti-trampas y rate limit (heredado del SPEC 06).
- Tests automatizados: el repo no tiene test runner.
- Modificar `lib/games/asteroids/`, `lib/games/tetris/`, `lib/games/arkanoid/`, `lib/games/serpentina/` o los juegos de `references/`.
- Otros juegos del catálogo (`gloton`, `invasores`, `ranaria`): un spec por juego.

## Data model

Sin tablas ni columnas nuevas. Cambia el contenido de `scores` (se borran 10 filas `is_seed`) y el `long` de una fila de `games` que ya existe. Sin cambios en `lib/games/types.ts`: `GameStatus`, `GameHud` y `GameCallbacks` bastan (`dead` no se usa y la victoria se emite como `gameover`). Sin cambio de esquema, así que no se regeneran los tipos de `lib/supabase/database.types.ts`.

Configuración en `GameScreen` (entrada nueva, sin tocar las existentes):

```ts
// components/game/game-screen.tsx
// "duelo-pixel": { create: createDueloPixelGame, width: 800, height: 600, showLives: false, showNext: false }
```

Estructura del motor:

| Archivo                              | Contenido                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/games/duelo-pixel/constants.ts` | `W = 800`, `H = 600`, `WALL = 8`, `PADDLE_W = 12`, `PADDLE_H = 90`, `PADDLE_MARGIN = 32`, `PLAYER_SPEED = 480`, `BALL_SIZE = 12`, `BALL_SPEED_STEP = 20`, `BALL_MAX_SPEED = 840`, `MAX_BOUNCE_DEG = 60`, `SERVE_MAX_DEG = 30`, `SPIN_ACCEL = 700`, `SPIN_MS = 500`, `SUBSTEP_PX = 6`, `SERVE_DELAY_MS = 900`, `POINT_PAUSE_MS = 600`, `MATCH_WON_MS = 2200`, `POINTS_TO_WIN = 7`, `POINT_BASE = 100`, `RALLY_HIT_BONUS = 10`, `RALLY_HIT_CAP = 30`, `MATCH_BONUS = 1000`, `CPU_DEAD_ZONE = 4`, `CPU_RETURN_FACTOR = 0.5` |
| `lib/games/duelo-pixel/rivals.ts`    | `RIVALS: readonly Rival[]` con los 5 rivales de la tabla siguiente                                                                                                                                                                                                                                                                                                                                         |
| `lib/games/duelo-pixel/utils.ts`     | `clamp`, `bounceVelocity(offset, speed, dir)`, `serveVelocity(speed, dir, random)`, `predictY(ball, targetX)` (extrapolación lineal con reflexión en `WALL` y `H − WALL`, sin efecto), `pointValue(rival, hits)`, `matchBonus(rival, diff)`, `aabbOverlap(a, b)`                                                                                                                                             |
| `lib/games/duelo-pixel/entities.ts`  | Tipos `Paddle`, `Ball`, `Rival`, `Phase`; `createBall`, `createPaddles`, `stepBall(ball, dt)` (gravedad de efecto incluida)                                                                                                                                                                                                                                                                                 |
| `lib/games/duelo-pixel/draw.ts`      | `drawCourt` (sobre un canvas fuera de pantalla), `drawPaddle`, `drawBall` (con estela), `drawScoreDigits` (dígitos de bloques 5×7), `drawRivalLabel`, `drawOverlay(ctx, title, lines)`                                                                                                                                                                                                                        |
| `lib/games/duelo-pixel/game.ts`      | Estado en clausura, `reset`, `startMatch`, `serve`, `update(dt)` (fases, subpasos, colisiones, IA, puntos), `draw()`, loop, input, pausa, overlays, `onHudChange` y `destroy`                                                                                                                                                                                                                                |

Rivales (`rivals.ts`):

| #   | Nombre    | Velocidad de pala (px/s) | Reacción (ms) | Error máx. (px) | Saque (px/s) |
| --- | --------- | ------------------------ | ------------- | --------------- | ------------ |
| 1   | `CHISPA`  | 260                      | 220           | ±40             | 360          |
| 2   | `ECO`     | 320                      | 180           | ±32             | 400          |
| 3   | `VOLTIO`  | 380                      | 140           | ±24             | 440          |
| 4   | `PRISMA`  | 440                      | 100           | ±16             | 480          |
| 5   | `NÉMESIS` | 500                      | 70            | ±10             | 520          |

Fragmento ilustrativo de los tipos:

```ts
// lib/games/duelo-pixel/entities.ts
export type Paddle = { x: number; y: number; vy: number }; // y = borde superior; vy en px/s (0 si quieta)
export type Ball = { x: number; y: number; vx: number; vy: number; speed: number; spin: -1 | 0 | 1; spinLeft: number };
export type Rival = { name: string; speed: number; reactionMs: number; error: number; serveSpeed: number };
export type Phase = "serve" | "rally" | "point" | "matchWon";
```

Convenciones:

- Coordenadas en píxeles con origen arriba a la izquierda. La pelota y las palas son rectángulos alineados a los ejes (`x`, `y` = esquina superior izquierda).
- La pala del jugador está en `x = 32` y la de la CPU en `x = 800 − 32 − 12 = 756`. Ambas se limitan a `[WALL, H − WALL − PADDLE_H]`.
- La pala del jugador se mueve a 480 px/s mientras `↑` o `↓` estén pulsadas. Si se pulsan las dos, no se mueve. `paddle.vy` vale `0` si está quieta o tocando el límite.
- `update(dt)`: `dt` en segundos, limitado a 0,05 s. La pelota avanza en `n = ceil(max(|vx|, |vy|) × dt / SUBSTEP_PX)` subpasos. En cada subpaso:
  - Aplica el efecto (`vy += spin × SPIN_ACCEL × dtSub` mientras `spinLeft > 0`).
  - Mueve la pelota.
  - Rebota en las paredes (`vy = −vy`, `spin = 0`).
  - Comprueba la pala hacia la que va la pelota (solo si `vx` apunta a ella, para evitar dobles golpes).
- Golpe de pala:
  - `offset = clamp((centroPelotaY − centroPalaY) / (PADDLE_H / 2), −1, 1)`.
  - `speed = min(speed + 20, 840)`.
  - Velocidad de salida: `vx = ±speed × cos(offset × 60°)` y `vy = speed × sin(offset × 60°)`.
  - La pelota se recoloca pegada a la cara de la pala y `rallyHits += 1`.
  - Si golpea el jugador y `player.vy ≠ 0`: `spin = sign(player.vy)` y `spinLeft = 500 ms`. Si golpea la CPU: `spin = 0`.
- IA:
  - Cada `reactionMs` la CPU fija `target`. Si `vx > 0`, `target = predictY(ball, 756) + error`, donde `error` es un número uniforme en `[−rival.error, +rival.error]` que se sortea al sacar y después de cada golpe del jugador. Si `vx ≤ 0`, `target = H / 2`.
  - Entre recálculos, el centro de la pala se mueve hacia `target` a `rival.speed` (al 50 % si `vx ≤ 0`) y se detiene a menos de 4 px.
- Fases internas (no cambian `status`):
  - `serve` (900 ms, pelota quieta en el centro) → `rally` → `point` (600 ms, destello del lado que pierde el punto) → `serve`, o `matchWon` (2 200 ms) → `serve` del siguiente rival.
  - Todas las fases se congelan en pausa.
- Punto:
  - Si la pelota sale por `x > W`, punto del jugador: `score += POINT_BASE × rival + RALLY_HIT_BONUS × min(rallyHits, 30)`.
  - Si sale por `x + BALL_SIZE < 0`, punto de la CPU.
  - Después, `rallyHits = 0`.
  - Si alguien llega a 7: si es el jugador, `score += MATCH_BONUS × rival × (7 − cpuPoints)` y pasa a `matchWon` (o a `gameover` con `won = true` si `rival = 5`); si es la CPU, pasa a `gameover` con `won = false`.
- Ejemplos:
  - Ganar un punto contra el rival 1 tras 4 golpes suma `100 + 40 = 140`.
  - Ganar 7–3 contra el rival 2 suma un bonus de `1 000 × 2 × 4 = 8 000`.
- Máximo plausible: 5 partidos ganados 7–0 con peloteos de 30+ golpes. Puntos: `7 × (100 × 15) + 7 × 300 × 5 = 21 000`. Bonus: `1 000 × 7 × 15 = 105 000`. Total: **126 000**, menor que `SCORE_LIMITS.maxScore` (9 999 999).
- El motor emite `score`, `lives: 0`, `level = rivalIndex + 1` y `status`. `onHudChange` solo se invoca si cambia algún campo. Nivel pasa a `r + 1` al empezar el `serve` del siguiente partido, no durante el interludio.
- Al reanudar se reinicia `lastTime` (primer `dt` = 0) y se conservan `phaseTimer` y el temporizador de reacción de la CPU.
- La pausa solo actúa en `playing`. Al reanudar, `paused` vuelve a `playing`.
- Entradas: `ArrowUp` / `ArrowDown` (`keydown` / `keyup` sobre un set de teclas), `KeyP` / `Escape` alternan la pausa y `Space` reinicia en `gameover` (solo con `!e.repeat`). En pausa y en `gameover` las flechas no mueven la pala.
- `restart()` rearma: rival 1, marcador 0–0, `score = 0`, `rallyHits = 0`, palas centradas, pelota en el centro, fase `serve` hacia la CPU y teclas pulsadas vacías.

## Dirección visual

Sin referencia visual en `references/`. El estilo es el CRT neón de la plataforma y sigue la portada `cover-duelo`: fondo `#0a0a18`, red discontinua en `--ink`, pala izquierda cyan, pala derecha magenta y pelota amarilla. Todo se dibuja con primitivas de canvas, sin `public/games/duelo-pixel/`. El marco CRT, el HUD de React y la barra inferior no cambian. Se diseña con `/frontend-design` en la implementación.

- **Pista (capa estática):**
  - Fondo `#0a0a18` con un leve degradado radial azul en el centro.
  - Bandas de pared de 8 px arriba y abajo en `--ink` al 30 %.
  - Red central discontinua de 2 px de ancho (10 px de trazo y 10 px de hueco), como en la portada.
  - Una línea fina cyan al 12 % delimita cada campo.
  - Se dibuja una vez en un canvas fuera de pantalla y se copia en cada frame con `drawImage`.
- **Palas:** rectángulos de 12×90 px con resplandor (`shadowBlur` 12) cyan (jugador) y magenta (CPU). Al golpear, la pala destella en blanco durante 80 ms.
- **Pelota:** cuadrado amarillo de 12 px con resplandor y una estela de las últimas 6 posiciones que se desvanece. Con efecto activo, la estela pasa a magenta y la pelota muestra un trazo blanco de 2 px que gira, para que el jugador vea que está curvando.
- **Marcador:** dígitos de bloques 5×7 dibujados con `fillRect` (8 px por bloque, 40×56 px por dígito), sin cargar fuentes. Están arriba, a 60 px a cada lado de la red: cyan para el jugador y magenta para la CPU.
- **Rival:** etiqueta `RIVAL 3/5 · VOLTIO` centrada abajo, en monospace negrita de 16 px y `--ink` al 70 %.
- **Punto:** el campo de quien perdió el punto destella en rojo-magenta al 15 % durante 150 ms.
- **Overlays:**
  - Velo `#0a0a18` al 75 % y texto monospace negrita centrado, como en Arkanoid.
  - `PAUSA` en cyan.
  - `¡VENCISTE A <RIVAL>!` en amarillo, con `+<bonus>` y `SIGUIENTE: <RIVAL>`.
  - `GAME OVER` en magenta, con `CAÍSTE ANTE <RIVAL> <j>–<c>`, el puntaje y `ESPACIO PARA REINICIAR`.
  - `¡CAMPEÓN DEL DUELO!` en amarillo, con el puntaje y `ESPACIO PARA REINICIAR`.
  - El título se ajusta para que quepa en 760 px.
- **Pausa:** la estela, los destellos y las fases se congelan con el motor.
- **Rendimiento:** la pista se cachea. Por frame solo se dibujan palas, pelota, estela, marcador, etiqueta y overlays.

## Implementation plan

Antes de empezar: leer en `node_modules/next/dist/docs/` lo relativo a Client Components y `useEffect` con `cacheComponents`, y a `revalidateTag` / `updateTag` para el catálogo cacheado (`cacheTag("games")`), porque la migración cambia el `long`. Invocar `/frontend-design` antes del paso 3.

1. **Constantes, rivales y utilidades.** Crear `lib/games/duelo-pixel/constants.ts`, `rivals.ts` y `utils.ts` con los valores de la sección Data model. Verificar: `npx tsc --noEmit` pasa, y una comprobación temporal fuera del repo confirma:
   - `pointValue(1, 4) = 140` y `pointValue(5, 45) = 800`.
   - `matchBonus(2, 4) = 8000`.
   - `predictY` de una pelota en `(400, 300)` con `vx = 400`, `vy = −400` hacia `x = 756` devuelve un valor dentro de `[8, 592]` igual al reflejado a mano.
2. **Entidades y física.** Crear `lib/games/duelo-pixel/entities.ts` con los tipos, `createBall`, `createPaddles` y `stepBall` (efecto incluido). Verificar: `npx tsc --noEmit` y `npm run lint` pasan.
3. **Dibujo.** Crear `lib/games/duelo-pixel/draw.ts` siguiendo la sección _Dirección visual_ y diseñado con `/frontend-design`. Verificar: `npx tsc --noEmit` y `npm run lint` pasan, y ninguna función supera ~50 líneas.
4. **Motor.** Crear `lib/games/duelo-pixel/game.ts` con `createDueloPixelGame`:
   - Estado en clausura, `reset`, `startMatch`, `serve`.
   - `update(dt)` con subpasos, colisiones, IA, puntos y fases.
   - `draw()`, loop con `requestAnimationFrame`, teclado en `window`, `onHudChange` y `destroy`.

   Verificar: `npx tsc --noEmit` y `npm run lint` pasan.
5. **Pausa, foco, overlays y scroll.**
   - `pause` / `resume` con `P` / `Escape` y overlay `PAUSA`.
   - Overlays `¡VENCISTE A <RIVAL>!`, `GAME OVER` y `¡CAMPEÓN DEL DUELO!`.
   - Pausa con `blur` y `visibilitychange`.
   - `preventDefault` sobre flechas y `Espacio`.
   - Reinicio con `Espacio` en `gameover`.

   Verificar: `npx tsc --noEmit` y `npm run lint` pasan.
6. **Catálogo.** Crear `supabase/migrations/20261103120000_activate_duelo_pixel.sql` y aplicarla con `apply_migration`. Si al implementar ya existe una migración con un timestamp posterior, usar la fecha del día. La migración hace dos cosas:
   - `delete from public.scores where game_id = 'duelo-pixel' and is_seed;`
   - `update public.games set long = 'El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Escala una liga de cinco rivales CPU, cada uno más rápido y certero, y usa el efecto para curvar la pelota donde no llegan.' where id = 'duelo-pixel';`

   Después, invalidar el catálogo cacheado (`cacheTag("games")`) o reiniciar el servidor de desarrollo. Verificar con `execute_sql`:
   - `select count(*) from scores where is_seed` = 40 (o 40 menos las semillas que hayan borrado otros specs aplicados antes).
   - `select count(*) from scores where game_id = 'duelo-pixel'` = 0.
   - `select count(*) from games` = 8.
   - El `long` nuevo está guardado y `get_advisors` (security) no da avisos nuevos.
7. **Registro.** Añadir `duelo-pixel` a `GAMES_CONFIG` y a `PLAYABLE_GAME_IDS`. Verificar:
   - `/juegos/duelo-pixel/jugar` muestra el juego.
   - `/juegos/gloton/jugar` sigue mostrando «JUEGO PRÓXIMAMENTE».
   - `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar` y `/juegos/serpentina/jugar` siguen igual.
8. **Guardado y ranking.** Comprobar de punta a punta GAME OVER → `saveScore` → `/juegos/duelo-pixel` y `/salon`, incluidos los estados con el ranking vacío (`game_stats` sin fila para `duelo-pixel` antes de la primera partida) y la victoria contra el rival 5. Para la victoria, usar una constante temporal `POINTS_TO_WIN = 1` que se retira antes de cerrar. Verificar con `execute_sql` y Playwright.
9. **Documentar.** Actualizar:
   - `CLAUDE.md`, Architecture notes:
     - Filas `is_seed`: 40, que cubren `gloton`, `invasores`, `ranaria` y `tetris`. Juegos no jugables: 3.
     - `duelo-pixel` en el punto de `GAMES_CONFIG` (800×600, `showLives: false`) y en la lista de carpetas de motores.
     - Nota de que su victoria también se emite como `gameover`.
   - `references/JUEGOS.md`: fila en la tabla, sección `DUELO PIXEL` con controles, reglas y puntuación, y quitarlo de «Juegos del catálogo aún no jugables».

   Verificar: `git diff` de ambos archivos muestra solo esos cambios.

## Acceptance criteria

**Build**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] `lib/games/duelo-pixel/` no importa `react` ni `next/*`.
- [ ] `git grep -nE "^let |^var " -- lib/games` no devuelve resultados.
- [ ] No se modifica ningún archivo de `lib/games/asteroids/`, `lib/games/tetris/`, `lib/games/arkanoid/`, `lib/games/serpentina/` ni de `references/` salvo `references/JUEGOS.md`.
- [ ] No se crea `public/games/duelo-pixel/` (el juego no usa assets).

**Integración**

- [ ] `/juegos/duelo-pixel/jugar` muestra dentro del marco CRT el canvas 800×600 con las dos palas centradas, la red, el marcador `0`–`0` y la etiqueta `RIVAL 1/5 · CHISPA`.
- [ ] `/juegos/gloton/jugar`, `/juegos/invasores/jugar` y `/juegos/ranaria/jugar` siguen mostrando «JUEGO PRÓXIMAMENTE»; `/juegos/inexistente/jugar` da 404.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar` y `/juegos/serpentina/jugar` se ven y se comportan igual que antes.
- [ ] SALIR navega a `/juegos/duelo-pixel`.
- [ ] La consola no muestra errores ni avisos de hidratación en `/juegos/duelo-pixel/jugar`.
- [ ] `/biblioteca` y la sección de juegos del home siguen mostrando 8 y 6 juegos, sin duplicados. El filtro `VERSUS` muestra solo DUELO PIXEL.
- [ ] `/juegos/duelo-pixel` muestra el `long` nuevo y ya no menciona «dos jugadores».

**Jugabilidad (manual)**

- [ ] Al entrar, la pelota está quieta en el centro 900 ms y luego sale hacia la CPU con un ángulo de como mucho ±30°.
- [ ] `↑` / `↓` mueven la pala del jugador a velocidad constante, que no sale de las bandas de pared; con las dos teclas pulsadas no se mueve.
- [ ] La pelota rebota en las paredes superior e inferior y nunca atraviesa una pala, ni siquiera a 840 px/s.
- [ ] Golpear con el centro de la pala devuelve la pelota casi horizontal; golpear con un extremo la devuelve con unos 60°.
- [ ] Cada golpe de pala sube la velocidad 20 px/s hasta un tope de 840 px/s; un nuevo saque vuelve a la velocidad de saque del rival.
- [ ] Golpear mientras la pala se mueve hace que la pelota curve visiblemente en el sentido del movimiento durante 500 ms; golpear con la pala quieta no curva; un rebote en la pared anula el efecto.
- [ ] La CPU devuelve la mayoría de pelotas rectas del rival 1 pero falla pelotas con efecto con más frecuencia que pelotas sin efecto (observable en 3 partidas).
- [ ] Ganar un punto contra el rival 1 con 4 golpes en el peloteo suma 140; los puntos de la CPU no restan.
- [ ] Ganar el partido 7–3 contra el rival 2 suma un bonus de 8 000 y muestra `¡VENCISTE A ECO!` con `+8000` durante 2,2 s; el siguiente partido empieza 0–0 contra `VOLTIO`.
- [ ] Perder un partido (la CPU llega a 7) muestra `GAME OVER`, `CAÍSTE ANTE <RIVAL> <j>–<c>`, el puntaje y «ESPACIO PARA REINICIAR».
- [ ] Ganar al rival 5 muestra `¡CAMPEÓN DEL DUELO!` con el puntaje, el HUD pasa a `gameover` y la puntuación se guarda (comprobable con `POINTS_TO_WIN = 1` temporal, retirado antes de cerrar).
- [ ] `Espacio` en `gameover` reinicia con puntuación 0, rival 1, marcador 0–0 y palas centradas.

**HUD React**

- [ ] Puntuación coincide con el estado del juego; Nivel muestra el rival actual con dos dígitos (`01`–`05`) y cambia al empezar el partido siguiente.
- [ ] El HUD no muestra Vidas.
- [ ] Jugador muestra el nombre de la sesión mock o `INVITADO`.
- [ ] `onHudChange` solo se invoca cuando cambia un campo (comprobable con un `console.count` temporal que se retira antes de cerrar).

**Pausa, foco y teclado**

- [ ] `P` y `Escape` pausan y reanudan; en pausa ni la pelota, ni las palas, ni los temporizadores de saque o interludio avanzan, y el canvas muestra `PAUSA`.
- [ ] Tras reanudar, la pelota no salta: el primer `dt` es 0.
- [ ] Cambiar de pestaña o quitar el foco a la ventana pausa el juego; volver no lo reanuda solo.
- [ ] Con el juego montado, flechas y `Espacio` no desplazan la página.
- [ ] Al salir de la ruta con SALIR o con el botón atrás el teclado deja de responder, y volver a entrar inicia una partida nueva. El doble efecto de React 19 no duplica la velocidad de la pelota ni de la pala.

**Guardado y leaderboard**

- [ ] Con sesión mock, un GAME OVER con puntuación mayor que 0 inserta exactamente una fila en `scores` con `game_id = 'duelo-pixel'`, el nombre de la sesión y esa puntuación.
- [ ] La barra del marco muestra `GUARDANDO` y después `GUARDADO #N`, donde `N` coincide con el rango en `/salon`.
- [ ] Ni el interludio entre partidos ni pausar o reanudar insertan filas; solo el `gameover` final inserta.
- [ ] Perder 0–7 contra el rival 1 (puntuación 0) no llama a `saveScore`. Sin sesión aparece «INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN» con enlace a `/auth` y no se inserta nada.
- [ ] Si el guardado falla se muestra `ERROR` con `REINTENTAR` y el juego sigue operativo.
- [ ] La fila guardada aparece en `/juegos/duelo-pixel` y en `/salon` sin reiniciar el servidor; la primera partida real ocupa el puesto #1.
- [ ] Antes de jugar, `/juegos/duelo-pixel` y `/salon` se renderizan sin errores con el ranking vacío, y la tarjeta muestra `best` 0 y `plays` 0.
- [ ] La puntuación máxima plausible (126 000) es menor que `SCORE_LIMITS.maxScore` (9 999 999).

**Base de datos**

- [ ] `select count(*) from games` devuelve 8. La fila `duelo-pixel` conserva `title` `DUELO PIXEL`, `cover-duelo`, color `cyan`, categoría `VERSUS` y `sort_order` 8, y su `long` es el texto nuevo.
- [ ] Antes de jugar, `select count(*) from scores where game_id = 'duelo-pixel'` devuelve 0 y `select count(*) from scores where is_seed` devuelve 40.
- [ ] Existe `supabase/migrations/20261103120000_activate_duelo_pixel.sql` (o su equivalente con la fecha del día) y `list_migrations` la muestra aplicada.
- [ ] `get_advisors` (security) no reporta avisos nuevos.

**Visual (manual)**

- [ ] A 1440×900 y a 1366×650 el canvas se ve completo (pantalla y barra inferior del marco) sin scroll vertical, manteniendo 4:3.
- [ ] A 390×844 el canvas no desborda horizontalmente y el juego se ve completo (solo teclado).
- [ ] La pala del jugador es cyan, la de la CPU magenta y la pelota amarilla, como en `cover-duelo`; la red es discontinua.
- [ ] Los dígitos del marcador se leen a 1366×650 y están a cada lado de la red con el color de su pala.
- [ ] La estela de la pelota pasa a magenta y el trazo blanco gira solo mientras el efecto está activo.
- [ ] Los overlays `PAUSA`, `¡VENCISTE A NÉMESIS!`, `GAME OVER` y `¡CAMPEÓN DEL DUELO!` son legibles y caben dentro de los 800 px del canvas.
- [ ] `git status` no lista imágenes ni fuentes nuevas.
- [ ] El marco CRT, el HUD de React y la barra inferior se ven igual que en los otros juegos.

**Sin efectos colaterales**

- [ ] Ninguna clave secreta ni `service_role` en el repo.
- [ ] `git status` lista solo `lib/games/duelo-pixel/`, `lib/games.ts`, `components/game/`, `supabase/migrations/`, `CLAUDE.md`, `references/JUEGOS.md` y este spec.

## Decisions

- **Sí:** activar la fila existente `duelo-pixel` en lugar de crear una nueva. Su título, categoría (`VERSUS`) y portada (paletas, red y pelota) ya representan el tema. Evita un duplicado en `/biblioteca` y no cambia el recuento de 8 juegos.
- **Sí:** escalera de 5 rivales CPU con partidos a 7 puntos; perder un partido es GAME OVER y ganar los 5 es la victoria. Decisión del usuario. Da una partida con principio y fin, un Nivel con significado (rival 1–5) y un máximo acotado.
- **No:** supervivencia sin fin con vidas. La descartó el usuario; dejaba el Nivel sin significado y la puntuación sin techo claro.
- **No:** modo a 2 jugadores en local. Decisión del usuario. Un leaderboard por nombre no encaja con dos personas en el mismo teclado y añadir un menú de modos no cabe en una rama.
- **Sí:** actualizar el `long` del catálogo por migración para quitar «partida local a dos jugadores». Decisión del usuario; el texto no puede prometer un modo que no existe. Título, `short`, portada y color se conservan.
- **Sí:** borrar las 10 semillas `is_seed` de `duelo-pixel`. Decisión del usuario. Con un máximo plausible de 126 000, las semillas (49 186–226 480) serían en su mayoría inalcanzables, el mismo caso que Arkanoid (SPEC 08) y Serpentina (SPEC 09). El ranking arranca vacío.
- **No:** conservar las semillas ni escalar la fórmula para alcanzarlas. Mezclaba datos inventados con partidas reales y obligaba a inflar los números sin motivo de juego.
- **Sí:** puntuación `100 × rival + 10 × min(golpes, 30)` por punto y `1 000 × rival × diferencia` por partido. Es la fórmula presentada en la Fase A y aceptada por el usuario. Premia avanzar en la liga, los peloteos largos y ganar con claridad. El tope de 30 golpes acota el máximo en 126 000.
- **Sí:** efecto solo en los golpes del jugador y predicción de la CPU que lo ignora. Decisión del agente (pendiente de confirmar). Es lo que permite ganar a los rivales rápidos con habilidad y no por suerte; el efecto en los golpes de la CPU queda fuera de alcance.
- **Sí:** ángulo de salida según el punto de impacto (±60°) y +20 px/s por golpe hasta 840 px/s. Decisión del agente (pendiente de confirmar). Da control al jugador y una tensión creciente en cada peloteo.
- **Sí:** subpasos de 6 px como máximo. A 840 px/s y `dt` = 50 ms la pelota recorre 42 px por frame, más que el grosor de la pala (12 px); sin subpasos la atravesaría.
- **Sí:** canvas 800×600, estilo CRT neón y sin sonido. Decisión del usuario (valores por defecto aceptados). No cambia `GameScreen` ni el marco 4:3, y es coherente con la portada `cover-duelo`.
- **Sí:** el primer saque de cada partido va hacia la CPU y después saca hacia quien perdió el punto. Decisión del agente (pendiente de confirmar). El jugador ve la primera jugada antes de tener que defender, y sacar hacia quien pierde da opción de responder.
- **Sí:** sin vidas, con `showLives: false` y `lives: 0`, como Tetris y Serpentina. El marcador del partido se dibuja en el canvas porque `GameHud` no tiene campos para él y no se amplía.
- **Sí:** victoria como `gameover` con overlay propio, igual que Arkanoid y Serpentina. No se amplía `GameStatus` y el guardado de `GameScreen` no se toca.
- **Sí:** marcador con dígitos de bloques dibujados con `fillRect`. La fuente `Press_Start_2P` se carga con `next/font` y un nombre de familia generado, que el motor no debe conocer. Los dígitos de bloques encajan con el estilo pixel sin depender de fuentes.
- **Sí:** solo flechas para mover. Es el control que ya usan los demás juegos; `W` / `S` quedan fuera de alcance.
- **Sí:** `Math.random` solo dentro del motor (ángulo de saque y error de la CPU). Cumple el contrato del motor.
- **Sí:** actualizar `references/JUEGOS.md`. Es la documentación de los juegos jugables, no material fuente, y quedaría desactualizada.
- **Sí:** validación manual más consultas SQL y `git grep`. Sin test runner en el repo.

## Risks

| Riesgo                                                                                                     | Mitigación                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La pelota atraviesa una pala a velocidad alta (42 px por frame con `dt` = 50 ms)                           | Subpasos de ≤ 6 px y colisión solo con la pala hacia la que va la pelota; criterio de jugabilidad a 840 px/s                                                                                                                                |
| Doble golpe: la pelota queda dentro de la pala y rebota varias veces en el mismo contacto                  | Tras el golpe se recoloca la pelota pegada a la cara de la pala y solo se comprueba la pala si `vx` apunta hacia ella                                                                                                                       |
| La dificultad no está bien calibrada: `NÉMESIS` es imbatible o `CHISPA` demasiado fácil                    | Los valores viven solo en `rivals.ts`. Si las pruebas manuales lo piden, se ajustan como mucho ±20 % y el cambio se anota en este spec antes de cerrar; criterio de que la CPU falla más con efecto                                          |
| La pelota se queda casi vertical por el efecto y el peloteo se eterniza                                    | El efecto dura 500 ms, un rebote en la pared lo anula y cada golpe de pala recalcula la velocidad con un ángulo máximo de 60°                                                                                                               |
| React 19 ejecuta `useEffect` dos veces en desarrollo y puede duplicar el loop o los listeners              | `destroy()` cancela `requestAnimationFrame` y retira cada listener con la misma referencia; criterio sobre el doble efecto                                                                                                                  |
| Tecla pegada: `keyup` se pierde al cambiar de ventana y la pala sigue moviéndose                           | En `blur` y `visibilitychange` se vacía el set de teclas además de pausar                                                                                                                                                                   |
| El catálogo cacheado (`use cache`, `cacheTag("games")`, `cacheLife("max")`) sigue sirviendo el `long` viejo | Invalidar el tag o reiniciar el servidor tras la migración; criterio sobre `/juegos/duelo-pixel`                                                                                                                                            |
| Ranking vacío: `game_stats` no tiene fila para `duelo-pixel`                                               | Criterio sobre `/juegos/duelo-pixel`, `/biblioteca` y `/salon` sin semillas; el paso 8 lo verifica                                                                                                                                          |
| El borrado de semillas es irreversible                                                                     | Acotado por `game_id = 'duelo-pixel' and is_seed`; se verifica el recuento tras aplicarla. Las semillas siguen en la migración `create_scores` si se quisieran recuperar                                                                     |
| Otro spec del game jam (o uno posterior) aplica antes otra migración y el timestamp queda desordenado       | Usar la fecha del día al implementar si ya existe una migración posterior; el recuento de semillas del criterio se ajusta a las que queden                                                                                                   |
| Una puntuación mayor que `SCORE_LIMITS.maxScore` haría fallar el guardado                                  | Máximo plausible de 126 000; sin riesgo                                                                                                                                                                                                     |

## Preguntas abiertas

1. **Efecto solo para el jugador.** La CPU no aplica efecto y su predicción lo ignora. Opción elegida por defecto: sí. La alternativa es que los rivales 4 y 5 también curven sus golpes, lo que sube la dificultad y añade trabajo.
2. **Nombres de los rivales** (`CHISPA`, `ECO`, `VOLTIO`, `PRISMA`, `NÉMESIS`). Opción elegida por defecto: estos cinco. Se pueden cambiar sin afectar a las reglas.
3. **Dirección del saque.** Opción elegida por defecto: el primer saque de cada partido va hacia la CPU y después saca hacia quien perdió el punto. La alternativa es que saque siempre quien ganó el último punto.
4. **Tope de velocidad y ángulo** (840 px/s, ±60°, +20 px/s por golpe). Opción elegida por defecto: estos valores, ajustables ±20 % tras las pruebas manuales.

## What is **not** in this spec

- Modo a 2 jugadores (local u online) y menú de modos.
- Efecto en los golpes de la CPU, power-ups, varias pelotas u obstáculos.
- Dificultad seleccionable o guardar el progreso de la liga.
- Sonido y música.
- Controles táctiles, ratón, gamepad o `W` / `S`.
- Cambiar título, `short`, portada o color del catálogo.
- Auth, anti-trampas y rate limit.
- Nuevos estados en `GameStatus` o campos en `GameHud`.
- Tests automatizados.
- Los otros juegos no jugables del catálogo.

Cada uno de estos puntos, si se aborda, va en su propio spec.
