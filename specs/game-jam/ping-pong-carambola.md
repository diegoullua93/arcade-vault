# GAME JAM «Ping-pong» — Juego CARAMBOLA jugable con leaderboard

> **Status:** draft
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 08, SPEC 09
> **Date:** 2026-11-03
> **Theme:** ping-pong
> **Objective:** Crear `carambola` como motor TypeScript en `lib/games/carambola/` (puzzle de tiros con rebotes para meter una pelota de ping-pong en un vaso a lo largo de 15 mesas), montarlo en `/juegos/carambola/jugar` (canvas 800×600), añadir su fila al catálogo y guardar su puntuación en el leaderboard existente.

---

## Por qué existe este spec

CARAMBOLA lleva el ping-pong al terreno del **puzzle de puntería**. La pelota rebota en la mesa, choca con la red y se desvía con palas, y el objetivo es meterla en un vaso al otro lado. Cada mesa es un nivel diseñado a mano, con red, palas fijas o móviles, muelles y huecos. El jugador ajusta ángulo y fuerza, lanza y observa una física con gravedad. Tiene 3 tiros por mesa: si falla los 3, la partida termina; si supera las 15 mesas, gana.

Como Serpentina (SPEC 09), es un juego **desde cero**: no hay carpeta en `references/` y las reglas las fija este spec. Reutiliza el patrón de los SPEC 05–09: un motor sin React en `lib/games/<id>/`, `GameScreen` parametrizado con `GAMES_CONFIG` (SPEC 07), los niveles como datos en `levels.ts` (como Arkanoid, SPEC 08) y el catálogo y `saveScore` genéricos por `game_id` (SPEC 06).

Lo que distingue a CARAMBOLA de los juegos ya jugables:

- **Por turnos, no por reflejos**: el jugador piensa el tiro sin prisa (salvo en las mesas con palas móviles) y la física hace el resto. Ningún juego jugable funciona así; amplía la categoría `PUZZLE`, que hoy solo tiene Tetris.
- **Gravedad y restitución por superficie**: la mesa devuelve el 75 % de la velocidad, la red absorbe casi todo (25 %), las palas devuelven el 95 % y los muelles el 115 %. Elegir dónde botar la pelota es el puzzle.
- **Tiros como vidas**: el HUD de Vidas muestra los tiros que quedan en la mesa actual (3 → 0) y se rellena al pasar de mesa.
- **Fila nueva** en `games`: `carambola`, `PUZZLE`, color `yellow`, portada nueva `cover-carambola`, `sort_order` 9.

Análisis de la fuente (juego nuevo, reglas cerradas con el usuario):

| Aspecto             | Resultado                                                                                                                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivos útiles     | Ninguno: no existe referencia. Se escribe `lib/games/carambola/` desde cero. `lib/games/arkanoid/levels.ts` sirve de modelo para definir niveles como datos                                                                                                                              |
| Globals y listeners | Estado en la clausura (`levelIndex`, `shotsLeft`, `angle`, `power`, `ball`, `bounces`, `phase`, `phaseTimer`, `restTimer`, `flightTime`, `moverTime`, `score`, `status`, `keys`, `lastTime`, `levelCache`). `keydown`/`keyup` en `window`, `blur` en `window` y `visibilitychange` en `document`, todos retirados en `destroy` |
| Canvas              | 800×600 interno, vista lateral con gravedad. Pelota de 7 px de radio, vaso con boca de 48 px                                                                                                                                                                                              |
| HUD y overlays      | Puntuación, Vidas (= tiros que quedan, 3 → 0) y Nivel (mesa `01`–`15`) van al HUD de React. El ángulo, la fuerza, la guía de trayectoria, el nombre de la mesa y los overlays `PAUSA`, `¡DENTRO!`, `FALLO`, `GAME OVER` y `¡MESA DOMINADA!` se dibujan en el canvas                          |
| Puntuación          | Cada acierto suma `500 + 250 × tiros sobrantes + 100 × min(rebotes, 3)`. Máximo por mesa: 1 300. Máximo plausible: **19 500** (15 mesas)                                                                                                                                                 |
| Estados             | `playing`, `paused` y `gameover` (3 fallos en una mesa o mesa 15 superada). Sin `dead`. Las fases internas (`aiming`, `flying`, `missed`, `scored`) no salen del motor                                                                                                                    |
| Controles           | `←` / `→` ajustan el ángulo, `↑` / `↓` la fuerza, `Espacio` lanza (y reinicia en `gameover`), `P` / `Escape` pausan                                                                                                                                                                       |
| Assets              | Ninguno: todo se dibuja con primitivas de canvas                                                                                                                                                                                                                                          |
| Discrepancias       | El HUD de React rotula «Vidas» y aquí cuenta tiros. Se acepta sin tocar `GameScreen` (ver Decisions y Preguntas abiertas)                                                                                                                                                                 |

## Scope

**In:**

- Motor en `lib/games/carambola/` (`constants.ts`, `utils.ts`, `entities.ts`, `levels.ts`, `draw.ts`, `game.ts`) con `createCarambolaGame(canvas, callbacks)` → `{ pause, resume, restart, destroy }`.
- Reglas:
  - Cada mesa tiene un lanzador fijo a la izquierda, un vaso y obstáculos.
  - En la fase `aiming` el jugador ajusta el ángulo (5°–85° sobre la horizontal, hacia la derecha) y la fuerza (0–100 %), y lanza con `Espacio`.
  - La pelota vuela con gravedad (900 px/s²) y rebota en las superficies.
  - Si entra en el vaso, es un **acierto**. Si sale del canvas por la izquierda, la derecha o abajo, se para (velocidad menor que 20 px/s durante 500 ms) o pasan 6 s, es un **fallo**. La parte superior está abierta: la pelota puede salir por arriba y volver por gravedad.
  - Cada mesa da 3 tiros.
  - Al fallar el 3.º tiro de una mesa se emite `gameover` con el overlay `GAME OVER`.
  - Al acertar en la mesa 15 se emite `gameover` con el overlay `¡MESA DOMINADA!`.
- 15 mesas definidas como datos en `levels.ts` (tabla en Data model), con 6 tipos de elemento: `table` (superficie de mesa), `wall` (muro o viga), `net` (red), `paddle` (pala fija inclinada), `bumper` (muelle circular) y `mover` (pala que oscila en vertical).
- Física:
  - Integración por subpasos (≤ 3 px por subpaso).
  - Colisión círculo contra segmento y círculo contra círculo, con restitución por tipo de superficie y fricción tangencial de 0,98.
  - La velocidad de la pelota tiene un tope de 1 000 px/s.
  - Un **rebote** se cuenta cuando la velocidad normal de impacto supera 120 px/s, en cualquier superficie salvo las paredes del vaso.
- Guía de trayectoria: en `aiming` se dibujan 12 puntos de la parábola de los primeros 0,35 s de vuelo, sin colisiones.
- Ángulo y fuerza se conservan entre tiros de la misma mesa. Al empezar una mesa nueva vuelven a 45° y 50 %.
- Puntuación:
  - Cada acierto suma `500 + 250 × tiros sobrantes + 100 × min(rebotes, 3)`. Los tiros sobrantes son los que quedan después del acierto: 2 si se acierta al primero.
  - Un fallo no resta.
- Interludios:
  - Tras un acierto, `¡DENTRO!` con `+N` durante 1 200 ms y luego la mesa siguiente con 3 tiros.
  - Tras un fallo que no es el 3.º, `FALLO` durante 700 ms y luego la pelota vuelve al lanzador.
- Canvas 800×600, sin cambios de dimensiones en `GameScreen`. Solo se añade la entrada de `carambola` en `GAMES_CONFIG`, con `showLives: true` y `showNext: false`.
- HUD de React:
  - Jugador y Puntuación.
  - Vidas: los tiros que quedan, `♥ ♥ ♥` → `—`.
  - Nivel: la mesa, `01`–`15`.
- Pausa con `P` / `Escape`, al perder el foco (`blur`) y al cambiar de pestaña (`visibilitychange`), con overlay `PAUSA`. `preventDefault` sobre flechas y `Espacio`. `Espacio` reinicia en `gameover` (solo en la pulsación inicial, `!e.repeat`).
- Registro en `GAMES_CONFIG` (`components/game/game-screen.tsx`) y en `PLAYABLE_GAME_IDS` (`lib/games.ts`).
- Migración `supabase/migrations/20261103120100_add_game_carambola.sql`: inserta la fila `carambola` en `games` (sin semillas).
- Portada CSS nueva `.cover-carambola` en `app/globals.css`, diseñada con `/frontend-design`.
- Guardado automático de la puntuación en GAME OVER y en victoria con el `saveScore` existente, sin código de leaderboard nuevo.
- Estilo CRT neón de la plataforma, dibujado en canvas (sección _Dirección visual_). Se diseña con `/frontend-design`, como exige `CLAUDE.md`.
- Actualizar `CLAUDE.md` (Architecture notes) y `references/JUEGOS.md` (tabla y sección del juego).

**Out of scope (para specs futuros):**

- Editor de mesas, mesas aleatorias o más de 15 mesas.
- Tirar hacia la izquierda, mover el lanzador o usar varias pelotas por tiro.
- Ratón para apuntar (arrastrar y soltar), controles táctiles o gamepad.
- Guía de trayectoria con rebotes o pistas de solución en la interfaz.
- Guardar el progreso entre partidas o elegir mesa.
- Sonido y música.
- Cambiar la etiqueta «Vidas» del HUD de React o añadir campos a `GameHud`.
- Semillas `is_seed` para `carambola`.
- Auth, anti-trampas y rate limit (heredado del SPEC 06).
- Tests automatizados: el repo no tiene test runner.
- Modificar `lib/games/asteroids/`, `lib/games/tetris/`, `lib/games/arkanoid/`, `lib/games/serpentina/` o los juegos de `references/`.

## Data model

Una fila nueva en `games`; ni tablas ni columnas nuevas. Sin cambio de esquema, así que no se regeneran los tipos de `lib/supabase/database.types.ts`. Sin cambios en `lib/games/types.ts`: `GameStatus`, `GameHud` y `GameCallbacks` bastan (`dead` no se usa y la victoria se emite como `gameover`).

Migración (ilustrativa):

```sql
-- supabase/migrations/20261103120100_add_game_carambola.sql
insert into public.games (id, title, short, long, category, cover, color, sort_order) values
  ('carambola', 'CARAMBOLA', 'Rebota la pelota hasta meterla en el vaso.',
   'Una pelota de ping-pong, un lanzador y un vaso al otro lado de la mesa. Ajusta ángulo y fuerza, aprovecha redes, palas y muelles, y encesta en tres tiros o menos. Quince mesas, cada una más retorcida.',
   'PUZZLE', 'cover-carambola', 'yellow', 9);
```

Efecto en la UI:

- `/biblioteca` pasa de 8 a 9 juegos y CARAMBOLA aparece la última.
- El filtro `PUZZLE` muestra TETRIS y CARAMBOLA.
- La sección de juegos del home sigue mostrando 6 (`games.slice(0, 6)` por `sort_order`), sin CARAMBOLA.
- La estadística del home pasa a `9 JUEGOS`.
- `/juegos/carambola` existe gracias a `generateStaticParams`.

Configuración en `GameScreen` (entrada nueva, sin tocar las existentes):

```ts
// components/game/game-screen.tsx
// carambola: { create: createCarambolaGame, width: 800, height: 600, showLives: true, showNext: false }
```

Estructura del motor:

| Archivo                            | Contenido                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/games/carambola/constants.ts` | `W = 800`, `H = 600`, `GRAVITY = 900`, `BALL_R = 7`, `LAUNCH_MIN = 300`, `LAUNCH_MAX = 900`, `MAX_BALL_SPEED = 1000`, `ANGLE_MIN = 5`, `ANGLE_MAX = 85`, `ANGLE_START = 45`, `ANGLE_RATE = 45`, `POWER_START = 50`, `POWER_RATE = 60`, `SUBSTEP_PX = 3`, `REST_SPEED = 20`, `REST_MS = 500`, `SHOT_TIMEOUT_MS = 6000`, `MISS_MS = 700`, `SCORED_MS = 1200`, `BOUNCE_MIN_SPEED = 120`, `FRICTION = 0.98`, `RESTITUTION = { table: 0.75, wall: 0.8, net: 0.25, paddle: 0.95, bumper: 1.15, mover: 0.95, rim: 0.6 }`, `CUP_MOUTH = 48`, `CUP_DEPTH = 56`, `CUP_WALL = 4`, `SHOTS_PER_LEVEL = 3`, `HIT_BASE = 500`, `SPARE_SHOT_BONUS = 250`, `BOUNCE_BONUS = 100`, `BOUNCE_CAP = 3`, `PREVIEW_TIME = 0.35`, `PREVIEW_DOTS = 12`, `OUT_MARGIN = 20` |
| `lib/games/carambola/levels.ts`    | `LEVELS: readonly Level[]` con las 15 mesas                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `lib/games/carambola/utils.ts`     | `clamp`, `launchVelocity(angleDeg, power)`, `closestPointOnSegment`, `collideSegment(ball, seg, restitution)` (devuelve la velocidad normal de impacto), `collideCircle(ball, circle, restitution)`, `moverY(mover, t)`, `isInCup(ball, cup)`, `cupSegments(cup)`, `hitPoints(spareShots, bounces)`, `previewPoints(origin, velocity)`                                                                                                                               |
| `lib/games/carambola/entities.ts`  | Tipos `Vec`, `Segment`, `Bumper`, `Mover`, `Cup`, `Level`, `Ball`, `Phase`; `createBall(launcher)`, `stepBall(ball, dt)`                                                                                                                                                                                                                                                                                                                                         |
| `lib/games/carambola/draw.ts`      | `drawLevelStatic` (sobre un canvas fuera de pantalla, uno por mesa), `drawMovers`, `drawLauncher(angle, power)`, `drawPreview`, `drawBall` (con estela), `drawCup`, `drawLevelLabel`, `drawOverlay(ctx, title, lines)`                                                                                                                                                                                                                                             |
| `lib/games/carambola/game.ts`      | Estado en clausura, `reset`, `loadLevel`, `launch`, `update(dt)` (entrada, subpasos, colisiones, acierto o fallo, fases), `draw()`, loop, input, pausa, overlays, `onHudChange` y `destroy`                                                                                                                                                                                                                                                                       |

Mesas (`levels.ts`). Todas tienen el lanzador en `x = 60` sobre la mesa de la izquierda y la boca del vaso con 48 px de ancho:

| #   | Nombre        | Elementos                                                                                    | Idea del tiro                                     |
| --- | ------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | `SAQUE`       | Mesa continua; vaso sobre la mesa a 420 px del lanzador                                      | Parábola directa, sin rebote                      |
| 2   | `MEDIA MESA`  | Mesa continua; vaso a 620 px                                                                 | Directo con fuerza alta o un bote en la mesa     |
| 3   | `RED`         | Red de 40 px a mitad de la mesa                                                              | Pasar la red; un bote en el campo rival           |
| 4   | `RED ALTA`    | Red de 140 px                                                                                | Parábola alta                                     |
| 5   | `TECHO`       | Red de 40 px y viga horizontal a `y = 200` sobre la mitad derecha                            | Tiro tenso bajo la viga con un bote               |
| 6   | `ESCALÓN`     | Vaso sobre una plataforma a 120 px por encima de la mesa                                     | Caída desde arriba sobre la plataforma            |
| 7   | `PALA`        | Muro de 160 px delante del vaso; pala fija a 45° arriba a la derecha                          | Golpear la pala para que caiga detrás del muro    |
| 8   | `DOBLE PALA`  | Dos palas fijas en zigzag; vaso tapado por una viga                                          | Dos rebotes en palas                              |
| 9   | `HUECO`       | Mesa partida con un hueco de 140 px; vaso en la segunda mitad                                | Saltar el hueco con un bote corto                 |
| 10  | `MUELLE`      | Hueco con un muelle de 24 px de radio en el fondo; vaso elevado detrás de un muro             | Usar el muelle para subir                         |
| 11  | `VAIVÉN`      | Pala móvil (amplitud 60 px, periodo 2 s) delante del vaso                                    | Lanzar cuando la pala deja paso                   |
| 12  | `COMPUERTAS`  | Dos palas móviles desfasadas medio periodo                                                   | Ventana de tiempo estrecha                        |
| 13  | `RICOCHÉ`     | Muro alto en el centro; pared vertical a la derecha del vaso                                 | Pasar el muro y rebotar en la pared hacia el vaso |
| 14  | `LABERINTO`   | Red alta, pala fija y muelle                                                                 | Pala → muelle → vaso                              |
| 15  | `FINAL`       | Red alta, muelle, pala móvil y vaso elevado                                                  | Combinación de todo lo anterior                   |

Las coordenadas exactas se fijan en `levels.ts` durante la implementación con estas restricciones:

- Todo dentro de 800×600.
- El vaso nunca se tapa por completo.
- Las mesas 1–10 (estáticas) incluyen una `solution` (`angle`, `power`) que acierta en una simulación con `dt` fijo de 1/120 s.
- Las mesas 11–15 se superan a mano al menos una vez antes de cerrar.

Fragmento ilustrativo de los tipos:

```ts
// lib/games/carambola/entities.ts
export type Vec = { x: number; y: number };
export type SurfaceKind = "table" | "wall" | "net" | "paddle";
export type Segment = { a: Vec; b: Vec; kind: SurfaceKind };
export type Bumper = { c: Vec; r: number };
export type Mover = { a: Vec; b: Vec; amplitude: number; periodMs: number; phase: number }; // oscila en y
export type Cup = { x: number; y: number }; // centro de la boca
export type Level = {
  name: string;
  launcher: Vec;
  cup: Cup;
  segments: Segment[];
  bumpers: Bumper[];
  movers: Mover[];
  solution?: { angle: number; power: number }; // solo mesas estáticas; no se muestra en la UI
};
export type Phase = "aiming" | "flying" | "missed" | "scored";
```

Convenciones:

- Coordenadas en píxeles con origen arriba a la izquierda y `y` hacia abajo.
- El ángulo se mide en grados sobre la horizontal, hacia la derecha.
- La velocidad de lanzamiento es `LAUNCH_MIN + (LAUNCH_MAX − LAUNCH_MIN) × power / 100`. Por ejemplo, 50 % → 600 px/s.
- `update(dt)`: `dt` en segundos, limitado a 0,05 s.
- En `flying` la pelota avanza en `n = ceil(|v| × dt / SUBSTEP_PX)` subpasos. En cada subpaso:
  - `vy += GRAVITY × dtSub` y se mueve la pelota.
  - Resuelve colisiones contra segmentos, muelles, palas móviles (en su posición de ese instante) y paredes del vaso. Reflexión con la restitución del tipo y `FRICTION` en la componente tangencial; la pelota se recoloca fuera de la superficie.
  - Limita `|v|` a 1 000 px/s.
- Un rebote cuenta (`bounces += 1`) si la velocidad normal de impacto supera 120 px/s y la superficie no es pared del vaso.
- Acierto: el centro de la pelota está dentro del interior del vaso, por debajo de la boca (`y > cup.y + BALL_R`), entre sus paredes.
- Fallo: `x < −20`, `x > 820` o `y > 620`; o `|v| < 20 px/s` durante 500 ms seguidos; o 6 s de vuelo.
- Puntuación por acierto: `hitPoints(shotsLeft, bounces) = 500 + 250 × shotsLeft + 100 × min(bounces, 3)`, con `shotsLeft` ya descontado el tiro actual. Ejemplos:
  - Acertar al primer tiro sin rebotes: 1 000.
  - Acertar al tercero con 1 rebote: 600.
  - Acertar al primero con 3 rebotes o más: 1 300.
- Máximo plausible: `15 × 1 300` = **19 500**, menor que `SCORE_LIMITS.maxScore` (9 999 999).
- Lanzar descuenta un tiro al instante (`shotsLeft -= 1`, que el HUD refleja en Vidas). Al acertar en una mesa que no es la 15: `scored` (1 200 ms) → `loadLevel(n + 1)` con `shotsLeft = 3`, 45° y 50 %. Al fallar con `shotsLeft > 0`: `missed` (700 ms) → `aiming` con la pelota en el lanzador. Al fallar con `shotsLeft = 0`: `gameover` con `won = false`. Al acertar en la mesa 15: `gameover` con `won = true`.
- Las palas móviles siguen `y(t) = y0 + amplitude × sin(2π × (t / periodMs) + phase)`. `moverTime` avanza en todas las fases salvo en pausa y se pone a 0 al cargar una mesa.
- Entradas:
  - `←` / `→`: ±1° al pulsar y ±45°/s mientras se mantienen.
  - `↑` / `↓`: ±1 % al pulsar y ±60 %/s mientras se mantienen. Ángulo y fuerza se limitan a sus rangos.
  - `Space` lanza en `aiming` y reinicia en `gameover` (solo con `!e.repeat`); `KeyP` / `Escape` alternan la pausa.
  - Las flechas solo actúan en `aiming`.
- El motor emite `score`, `lives = shotsLeft`, `level = levelIndex + 1` y `status`. `onHudChange` solo se invoca si cambia algún campo.
- Al reanudar se reinicia `lastTime` (primer `dt` = 0) y se conservan `phaseTimer`, `restTimer`, `flightTime` y `moverTime`.
- La pausa solo actúa en `playing`. Al reanudar, `paused` vuelve a `playing`.
- `restart()` rearma: mesa 1, `shotsLeft = 3`, `score = 0`, 45°, 50 %, fase `aiming`, `moverTime = 0` y teclas pulsadas vacías.

## Dirección visual

Sin referencia visual en `references/`. El estilo es el CRT neón de la plataforma con el amarillo como color propio del juego (el color de su fila en `games`). Todo se dibuja con primitivas de canvas, sin `public/games/carambola/`. El marco CRT, el HUD de React y la barra inferior no cambian. Se diseña con `/frontend-design` en la implementación.

- **Fondo:** `#0a0a18` con una rejilla muy tenue de 40 px (`--ink` al 4 %), como una pizarra de jugadas.
- **Mesas:** vista lateral de mesa de ping-pong.
  - El tablero es una franja de 10 px con relleno verde oscuro y borde superior en `--green` con resplandor.
  - Patas finas en `--ink` al 25 % (decorativas, sin colisión).
  - Una línea blanca de 2 px marca el borde del tablero.
- **Red:** malla de líneas cruzadas blancas al 60 % con un poste superior más brillante.
- **Muros y vigas:** barras `--ink` al 35 % con borde cyan tenue.
- **Palas fijas y móviles:** pala redondeada en magenta con mango corto oscuro. Las móviles llevan un rastro guía discontinuo que marca su recorrido.
- **Muelles:** anillos cyan que se expanden durante 150 ms al recibir un golpe.
- **Vaso:** trapecio con contorno amarillo y resplandor, y un brillo interior que pulsa suavemente. Al acertar, destello amarillo y 8 partículas que suben durante 400 ms.
- **Lanzador:** base cyan con un cañón que gira según el ángulo. La fuerza se ve en una barra vertical de 80 px junto a la base, de verde a amarillo y a magenta. Debajo, el texto `45° · 50%` en monospace de 14 px.
- **Guía:** 12 puntos cyan decrecientes en la parábola de los primeros 0,35 s.
- **Pelota:** círculo blanco de 7 px de radio con resplandor suave y una estela de 8 posiciones.
- **Etiqueta de mesa:** `MESA 07 · PALA` arriba a la izquierda, en monospace negrita de 16 px.
- **Overlays:**
  - Velo `#0a0a18` al 75 % y texto monospace negrita centrado, como en Arkanoid.
  - `PAUSA` en cyan.
  - `¡DENTRO!` en amarillo, con `+N`.
  - `FALLO` en magenta, con `QUEDAN N TIROS`.
  - `GAME OVER` en magenta, con `MESA NN`, el puntaje y `ESPACIO PARA REINICIAR`.
  - `¡MESA DOMINADA!` en amarillo, con el puntaje y `ESPACIO PARA REINICIAR`.
  - El título se ajusta para que quepa en 760 px.
- **Portada `cover-carambola`** (`app/globals.css`, mismo patrón de capas que `cover-duelo`): fondo oscuro con tinte amarillo, línea de mesa verde, un vaso amarillo a la derecha, una pelota blanca y 4–5 puntos en arco que dibujan la trayectoria.
- **Pausa:** palas móviles, partículas y estela se congelan con el motor.
- **Rendimiento:** la geometría estática de cada mesa (fondo, mesas, red, muros, palas fijas y muelles en reposo) se dibuja una vez por mesa en un canvas fuera de pantalla. Por frame solo se dibujan palas móviles, vaso, lanzador, guía, pelota, efectos y overlays.

## Implementation plan

Antes de empezar: leer en `node_modules/next/dist/docs/` lo relativo a Client Components y `useEffect` con `cacheComponents`, a `generateStaticParams` y a `revalidateTag` / `updateTag` para el catálogo cacheado (`cacheTag("games")`), porque se añade una fila. Invocar `/frontend-design` antes del paso 4.

1. **Constantes y utilidades.** Crear `lib/games/carambola/constants.ts` y `utils.ts` con los valores de la sección Data model. Verificar: `npx tsc --noEmit` pasa, y una comprobación temporal fuera del repo confirma:
   - `hitPoints(2, 0) = 1000`, `hitPoints(0, 1) = 600` y `hitPoints(2, 5) = 1300`.
   - `launchVelocity(45, 50)` tiene módulo 600.
   - `collideSegment` sobre una mesa horizontal con `vy = 400` devuelve `vy = −300`.
2. **Entidades y física.** Crear `lib/games/carambola/entities.ts` con los tipos, `createBall` y `stepBall`. Verificar: `npx tsc --noEmit` y `npm run lint` pasan.
3. **Mesas.** Crear `lib/games/carambola/levels.ts` con las 15 mesas de la tabla y la `solution` de las mesas 1–10. Verificar con una simulación temporal, fuera del repo o retirada antes de cerrar, con `dt` = 1/120 s:
   - La `solution` de cada mesa 1–10 acierta.
   - Ningún elemento queda fuera de 800×600.
4. **Dibujo.** Crear `lib/games/carambola/draw.ts` siguiendo la sección _Dirección visual_ y diseñado con `/frontend-design`. Verificar: `npx tsc --noEmit` y `npm run lint` pasan, y ninguna función supera ~50 líneas.
5. **Motor.** Crear `lib/games/carambola/game.ts` con `createCarambolaGame`:
   - Estado en clausura, `reset`, `loadLevel` (con caché de la capa estática) y `launch`.
   - `update(dt)` con entrada, subpasos, colisiones, acierto o fallo, rebotes y fases.
   - `draw()`, loop con `requestAnimationFrame`, teclado en `window`, `onHudChange` y `destroy`.

   Verificar: `npx tsc --noEmit` y `npm run lint` pasan.
6. **Pausa, foco, overlays y scroll.**
   - `pause` / `resume` con `P` / `Escape` y overlay `PAUSA`.
   - Overlays `¡DENTRO!`, `FALLO`, `GAME OVER` y `¡MESA DOMINADA!`.
   - Pausa con `blur` y `visibilitychange`.
   - `preventDefault` sobre flechas y `Espacio`.
   - Reinicio con `Espacio` en `gameover`.

   Verificar: `npx tsc --noEmit` y `npm run lint` pasan.
7. **Catálogo y portada.**
   - Crear `supabase/migrations/20261103120100_add_game_carambola.sql` y aplicarla con `apply_migration`. Si al implementar ya existe una migración con un timestamp posterior, usar la fecha del día. Si `sort_order` 9 ya está ocupado, usar el siguiente libre.
   - Añadir `.cover-carambola` a `app/globals.css`, diseñada con `/frontend-design`.
   - Invalidar el catálogo cacheado (`cacheTag("games")`) o reiniciar el servidor de desarrollo.

   Verificar con `execute_sql`:
   - `select count(*) from games` = 9.
   - La fila `carambola` tiene categoría `PUZZLE`, color `yellow`, `cover-carambola` y `sort_order` 9.
   - `select count(*) from scores where game_id = 'carambola'` = 0.
   - `get_advisors` (security) no da avisos nuevos.
8. **Registro.** Añadir `carambola` a `GAMES_CONFIG` y a `PLAYABLE_GAME_IDS`. Verificar:
   - `/juegos/carambola/jugar` muestra el juego.
   - `/juegos/gloton/jugar` sigue mostrando «JUEGO PRÓXIMAMENTE».
   - Los juegos ya jugables siguen igual.
9. **Guardado y ranking.** Comprobar de punta a punta GAME OVER → `saveScore` → `/juegos/carambola` y `/salon`, incluidos el ranking vacío y la victoria en la mesa 15. Para la victoria, usar temporalmente `LEVELS.slice(14)` y retirarlo antes de cerrar. Verificar con `execute_sql` y Playwright.
10. **Documentar.** Actualizar:
    - `CLAUDE.md`, Architecture notes: `games` con 9 filas, `carambola` en el punto de `GAMES_CONFIG` (800×600, `showLives: true` con tiros como vidas), carpeta del motor y lista de specs si procede.
    - `references/JUEGOS.md`: fila en la tabla y sección `CARAMBOLA` con controles, reglas y puntuación.

    Verificar: `git diff` de ambos archivos muestra solo esos cambios.

## Acceptance criteria

**Build**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores (el build genera `/juegos/carambola`).
- [ ] `lib/games/carambola/` no importa `react` ni `next/*`.
- [ ] `git grep -nE "^let |^var " -- lib/games` no devuelve resultados.
- [ ] No se modifica ningún archivo de `lib/games/asteroids/`, `lib/games/tetris/`, `lib/games/arkanoid/`, `lib/games/serpentina/` ni de `references/` salvo `references/JUEGOS.md`.
- [ ] No se crea `public/games/carambola/` (el juego no usa assets).

**Integración**

- [ ] `/juegos/carambola/jugar` muestra, dentro del marco CRT, el canvas 800×600 con la mesa 1, el lanzador a 45° y 50 %, la guía de trayectoria y el vaso.
- [ ] `/juegos/gloton/jugar` (y los demás no jugables) siguen mostrando «JUEGO PRÓXIMAMENTE»; `/juegos/inexistente/jugar` da 404.
- [ ] Los juegos ya jugables (`asteroids`, `tetris`, `arkanoid`, `serpentina`) se ven y se comportan igual que antes.
- [ ] SALIR navega a `/juegos/carambola`, que muestra título, `short`, `long`, la portada `cover-carambola` y el ranking vacío.
- [ ] La consola no muestra errores ni avisos de hidratación en `/juegos/carambola/jugar`.
- [ ] `/biblioteca` muestra 9 juegos sin duplicados, con CARAMBOLA la última; el filtro `PUZZLE` muestra TETRIS y CARAMBOLA.
- [ ] La sección de juegos del home sigue mostrando 6 juegos y la estadística del home muestra `9 JUEGOS`.

**Jugabilidad (manual)**

- [ ] `←` / `→` cambian el ángulo entre 5° y 85°, y `↑` / `↓` la fuerza entre 0 % y 100 %. Un toque cambia 1 unidad y mantener pulsado cambia 45°/s y 60 %/s. El texto `NN° · NN%` y la guía se actualizan al instante.
- [ ] `Espacio` lanza: la pelota sale del cañón con la velocidad `300 + 6 × fuerza` px/s y describe una parábola. Durante el vuelo las flechas y `Espacio` no hacen nada.
- [ ] La pelota bota en la mesa perdiendo velocidad, apenas rebota en la red, se desvía en las palas y sale despedida con más velocidad de los muelles.
- [ ] La pelota nunca atraviesa una mesa, una red, una pala (fija o móvil) ni la pared del vaso.
- [ ] Meter la pelota en el vaso muestra `¡DENTRO!` con `+N` durante 1,2 s y pasa a la mesa siguiente con 3 tiros, 45° y 50 %.
- [ ] Acertar la mesa 1 al primer tiro sin rebotes suma 1 000; acertar al tercer tiro con 1 rebote suma 600.
- [ ] Que la pelota salga por un lateral o por abajo, se quede parada 0,5 s o pase 6 s en vuelo es un fallo: aparece `FALLO` con `QUEDAN N TIROS`, la pelota vuelve al lanzador y se conservan ángulo y fuerza.
- [ ] Salir por arriba no es fallo: la pelota vuelve a caer.
- [ ] Fallar el 3.er tiro de una mesa muestra `GAME OVER` con la mesa, el puntaje y «ESPACIO PARA REINICIAR».
- [ ] Acertar en la mesa 15 muestra `¡MESA DOMINADA!` con el puntaje, el HUD pasa a `gameover` y la puntuación se guarda (comprobable con `LEVELS.slice(14)` temporal, retirado antes de cerrar).
- [ ] Las palas móviles de las mesas 11–15 oscilan 60 px con periodo de 2 s, también mientras se apunta.
- [ ] Las 15 mesas se han superado a mano al menos una vez; las mesas 1–10 se aciertan con su `solution`.
- [ ] `Espacio` en `gameover` reinicia con puntuación 0, mesa 1 y 3 tiros.

**HUD React**

- [ ] Puntuación coincide con el estado del juego; Nivel muestra la mesa con dos dígitos (`01`–`15`).
- [ ] Vidas muestra `♥ ♥ ♥` al empezar cada mesa, pierde un corazón al lanzar y muestra `—` tras el 3.er lanzamiento.
- [ ] Jugador muestra el nombre de la sesión mock o `INVITADO`.
- [ ] `onHudChange` solo se invoca cuando cambia un campo (comprobable con un `console.count` temporal que se retira antes de cerrar).

**Pausa, foco y teclado**

- [ ] `P` y `Escape` pausan y reanudan en cualquier fase; en pausa la pelota, las palas móviles y los temporizadores no avanzan, y el canvas muestra `PAUSA`.
- [ ] Tras reanudar, la pelota no salta: el primer `dt` es 0.
- [ ] Cambiar de pestaña o quitar el foco a la ventana pausa el juego; volver no lo reanuda solo.
- [ ] Con el juego montado, flechas y `Espacio` no desplazan la página.
- [ ] Al salir de la ruta con SALIR o con el botón atrás el teclado deja de responder, y volver a entrar inicia una partida nueva. El doble efecto de React 19 no duplica la gravedad ni el ritmo de ajuste del ángulo.

**Guardado y leaderboard**

- [ ] Con sesión mock, un GAME OVER con puntuación mayor que 0 inserta exactamente una fila en `scores` con `game_id = 'carambola'`, el nombre de la sesión y esa puntuación.
- [ ] La barra del marco muestra `GUARDANDO` y después `GUARDADO #N`, donde `N` coincide con el rango en `/salon`.
- [ ] Pasar de mesa, pausar o reanudar no insertan filas; solo el `gameover` final inserta.
- [ ] Fallar los 3 tiros de la mesa 1 (puntuación 0) no llama a `saveScore`. Sin sesión aparece «INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN» con enlace a `/auth` y no se inserta nada.
- [ ] Si el guardado falla se muestra `ERROR` con `REINTENTAR` y el juego sigue operativo.
- [ ] La fila guardada aparece en `/juegos/carambola` y en `/salon` sin reiniciar el servidor; la primera partida real ocupa el puesto #1.
- [ ] Antes de jugar, `/juegos/carambola`, `/biblioteca` y `/salon` se renderizan sin errores con el ranking vacío, y la tarjeta muestra `best` 0 y `plays` 0.
- [ ] La puntuación máxima plausible (19 500) es menor que `SCORE_LIMITS.maxScore` (9 999 999).

**Base de datos**

- [ ] `select count(*) from games` devuelve 9 y `select id, category, color, cover, sort_order from games where id = 'carambola'` devuelve `carambola | PUZZLE | yellow | cover-carambola | 9`.
- [ ] Antes de jugar, `select count(*) from scores where game_id = 'carambola'` devuelve 0; el número de filas `is_seed` no cambia.
- [ ] Existe `supabase/migrations/20261103120100_add_game_carambola.sql` (o su equivalente con la fecha del día) y `list_migrations` la muestra aplicada.
- [ ] `get_advisors` (security) no reporta avisos nuevos.

**Visual (manual)**

- [ ] A 1440×900 y a 1366×650 el canvas se ve completo (pantalla y barra inferior del marco) sin scroll vertical, manteniendo 4:3.
- [ ] A 390×844 el canvas no desborda horizontalmente y el juego se ve completo (solo teclado).
- [ ] Mesa, red, palas, muelles, vaso y pelota se distinguen entre sí y del fondo; la pelota blanca se ve sobre cualquier elemento.
- [ ] El cañón del lanzador gira con el ángulo y la barra de fuerza se llena con la fuerza.
- [ ] Los muelles se iluminan al golpearlos y el vaso destella al acertar.
- [ ] La portada `cover-carambola` se ve en `/biblioteca` y en `/juegos/carambola` con el mismo nivel de detalle que las demás portadas.
- [ ] Los overlays `PAUSA`, `¡DENTRO!`, `FALLO`, `GAME OVER` y `¡MESA DOMINADA!` son legibles y caben dentro de los 800 px del canvas.
- [ ] `git status` no lista imágenes ni fuentes nuevas.
- [ ] El marco CRT, el HUD de React y la barra inferior se ven igual que en los otros juegos.

**Sin efectos colaterales**

- [ ] Ninguna clave secreta ni `service_role` en el repo.
- [ ] `git status` lista solo `lib/games/carambola/`, `lib/games.ts`, `components/game/`, `app/globals.css`, `supabase/migrations/`, `CLAUDE.md`, `references/JUEGOS.md` y este spec.

## Decisions

- **Sí:** fila nueva `carambola` en `games` (`PUZZLE`, `yellow`, `cover-carambola`, `sort_order` 9). Ninguna fila no jugable encaja con un puzzle de ping-pong y `duelo-pixel` la activa el otro spec del game jam. Una portada CSS nueva sigue el patrón del resto del catálogo.
- **Sí:** 15 mesas con 3 tiros cada una; fallar los 3 es GAME OVER y acertar la mesa 15 es la victoria. Decisión del usuario. Da una partida con final y un máximo acotado (19 500), fácil de comprobar.
- **No:** una bolsa global de tiros. La descartó el usuario; hacía que el fallo dependiera de toda la partida y no de cada mesa.
- **Sí:** puntuación `500 + 250 × tiros sobrantes + 100 × min(rebotes, 3)`. Es la fórmula presentada en la Fase A y aceptada por el usuario. Premia acertar al primer tiro y las carambolas con rebotes, con un techo de 1 300 por mesa.
- **Sí:** canvas 800×600, estilo CRT neón y sin sonido. Decisión del usuario (valores por defecto aceptados). No cambia `GameScreen` ni el marco 4:3.
- **Sí:** tiros como vidas (`showLives: true`, `lives = shotsLeft`). Decisión del agente (pendiente de confirmar). Reutiliza el HUD sin tocar `GameScreen` y fallar un tiro tiene la misma lectura que perder una bola en Arkanoid. La etiqueta sigue siendo «Vidas».
- **No:** añadir una etiqueta configurable (`livesLabel`) a `GAMES_CONFIG`. Cambia `GameScreen` y los tipos para un matiz de texto; queda como pregunta abierta.
- **Sí:** guía de trayectoria de 0,35 s sin colisiones. Decisión del agente (pendiente de confirmar). Ayuda a apuntar sin resolver el puzzle; una guía con rebotes lo resolvería.
- **Sí:** el ángulo y la fuerza se conservan entre tiros de la misma mesa. Decisión del agente (pendiente de confirmar). El jugador corrige su tiro anterior en vez de empezar de cero; es lo que hace que el puzzle sea de ajuste fino.
- **Sí:** solo se tira hacia la derecha (5°–85°). Las 15 mesas se diseñan así; tirar hacia atrás no aporta y complica el control.
- **Sí:** restitución distinta por superficie (mesa 0,75, red 0,25, pala 0,95, muelle 1,15). Cada elemento tiene un papel distinto en el puzzle; el tope de 1 000 px/s evita que los muelles disparen la pelota sin límite.
- **Sí:** subpasos de 3 px (menos de la mitad del radio de 7 px). A 1 000 px/s y `dt` = 50 ms la pelota recorre 50 px por frame; sin subpasos atravesaría las redes y las palas finas.
- **Sí:** `solution` en los datos de las mesas 1–10, sin mostrarla en la UI. Hace comprobable que cada mesa estática tiene solución. Las mesas con palas móviles dependen del momento del tiro y se verifican a mano.
- **Sí:** victoria como `gameover` con overlay propio, igual que Arkanoid y Serpentina. No se amplía `GameStatus` y el guardado de `GameScreen` no se toca.
- **Sí:** sin semillas para `carambola`. El ranking arranca vacío, como Asteroids, Arkanoid y Serpentina.
- **Sí:** actualizar `references/JUEGOS.md`. Es la documentación de los juegos jugables, no material fuente, y quedaría desactualizada.
- **Sí:** validación manual, simulación temporal de las soluciones, consultas SQL y `git grep`. Sin test runner en el repo.

## Risks

| Riesgo                                                                                                    | Mitigación                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Una mesa no tiene solución o solo la tiene con una precisión imposible de alcanzar con el teclado         | `solution` verificada por simulación en las mesas 1–10, superación manual de las 15 y paso de ajuste de 1° / 1 %; criterio de jugabilidad                                                          |
| La pelota atraviesa redes, palas o la pared del vaso (túnel)                                              | Subpasos de ≤ 3 px, recolocación fuera de la superficie tras cada choque y tope de 1 000 px/s; criterio específico                                                                                 |
| La pelota queda temblando sobre una superficie o en una esquina y el tiro no termina                      | Fallo por reposo (< 20 px/s durante 500 ms) y por tiempo máximo de 6 s                                                                                                                             |
| La física varía con el `dt` y la `solution` simulada falla en el navegador                                | La simulación de verificación usa `dt` = 1/120 s; los subpasos de 3 px hacen la integración casi independiente del frame. Si alguna mesa falla en el navegador, se ajusta su geometría, no la física |
| Rebotes contados de más al rodar por la mesa                                                              | Solo cuenta un impacto con velocidad normal mayor que 120 px/s y el bonus tiene un tope de 3 rebotes                                                                                               |
| La etiqueta «Vidas» confunde al contar tiros                                                              | Los overlays `FALLO` y `GAME OVER` hablan de tiros; queda como pregunta abierta añadir `livesLabel` en otro spec                                                                                   |
| React 19 ejecuta `useEffect` dos veces en desarrollo y puede duplicar el loop o los listeners             | `destroy()` cancela `requestAnimationFrame` y retira cada listener con la misma referencia; criterio sobre el doble efecto                                                                         |
| Tecla pegada: `keyup` se pierde al cambiar de ventana y el ángulo sigue girando                           | En `blur` y `visibilitychange` se vacía el set de teclas además de pausar                                                                                                                          |
| El catálogo cacheado (`use cache`, `cacheTag("games")`, `cacheLife("max")`) no muestra la fila nueva      | Invalidar el tag o reiniciar el servidor tras la migración; criterio sobre `/biblioteca` con 9 juegos                                                                                              |
| `sort_order` 9 ya ocupado o migración con timestamp desordenado si otro spec se aplica antes              | Usar el siguiente `sort_order` libre y la fecha del día; los criterios se ajustan al valor usado                                                                                                   |
| Una puntuación mayor que `SCORE_LIMITS.maxScore` haría fallar el guardado                                 | Máximo plausible de 19 500; sin riesgo                                                                                                                                                             |

## Preguntas abiertas

1. **Tiros mostrados como «Vidas» en el HUD.** Opción elegida por defecto: sí, sin tocar `GameScreen`. La alternativa es añadir una etiqueta configurable (`livesLabel: "Tiros"`) a `GAMES_CONFIG`, que cambia `GameScreen`.
2. **Guía de trayectoria corta (0,35 s, sin rebotes).** Opción elegida por defecto: sí. Las alternativas son quitarla para más dificultad o alargarla en las primeras mesas.
3. **Ángulo y fuerza conservados entre tiros de la misma mesa.** Opción elegida por defecto: sí. La alternativa es volver a 45° y 50 % tras cada fallo.
4. **Nombre y textos del catálogo** (`CARAMBOLA`, `short` y `long` de la migración) **y color `yellow`**. Opción elegida por defecto: los indicados en Data model.

## What is **not** in this spec

- Editor de mesas, mesas aleatorias o más de 15 mesas.
- Tiros hacia la izquierda, lanzador móvil o varias pelotas.
- Apuntar con el ratón, controles táctiles o gamepad.
- Guía con rebotes o pistas de solución.
- Guardar el progreso o elegir mesa.
- Sonido y música.
- Etiqueta configurable del HUD o campos nuevos en `GameHud` y `GameStatus`.
- Semillas para `carambola`.
- Auth, anti-trampas y rate limit.
- Tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propio spec.
