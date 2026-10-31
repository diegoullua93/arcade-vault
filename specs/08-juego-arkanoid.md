# SPEC 08 — Juego ARKANOID jugable con leaderboard

> **Status:** implemented
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-31
> **Objective:** Portar `references/04-arkanoid` a un motor TypeScript en `lib/games/arkanoid/`, montarlo en `/juegos/arkanoid/jugar` (canvas 800×600) y guardar su puntuación en el leaderboard existente, renombrando la fila `bloque-buster` del catálogo a `arkanoid`.

---

## Por qué existe este spec

El SPEC 05 portó Asteroids y fijó el patrón (motor sin React + `GameScreen`); el SPEC 06 hizo genérico el catálogo y el guardado de puntuaciones por `game_id`; el SPEC 07 parametrizó `GameScreen` con `GAMES_CONFIG` y renombró `caida` a `tetris`. Arkanoid encaja casi tal cual en ese patrón (800×600, con vidas y niveles), pero la fuente trae tres cosas que no:

- Un **spritesheet PNG** (`assets/spritesheet-breakout.png`) que hay que servir desde `public/` y cargar dentro del motor, con el loop arrancando solo cuando la imagen está lista (y sin fugas si el componente se desmonta mientras carga).
- Un estado **`win`** (completar el nivel 5) que no existe en `GameStatus`.
- El catálogo ya contiene el juego con otro id (`bloque-buster`, «BLOQUE BUSTER», 10 filas semilla) y esas semillas (37 347–230 564) son inalcanzables: el máximo real es 2 080 puntos.

`references/04-arkanoid/game.js` (268 líneas) está escrito con globals, `getElementById`, `new Audio(...)`, listeners en `document` y en el canvas que nunca se retiran, y un `requestAnimationFrame` que no se cancela. Eso no funciona en el App Router (montaje doble de React 19, navegación cliente, scroll con flechas).

Archivos de referencia en `references/04-arkanoid/`:

| Archivo                           | Contenido relevante                                                                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `game.js`                         | Constantes (`PADDLE_SPEED`, `BLOCK_*`, `BASE_BALL_VX/VY`), `paddle`, `ball`, `loadLevel`, `update(dt)`, colisiones AABB, `draw`, overlays, loop |
| `levels.js`                       | `LEVELS`: 5 niveles `{ speed, blocks[] }` generados por código (parrilla, pirámide, ajedrez, huecos, marco + cruz)                              |
| `assets/spritesheet.js`           | Tablas `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION = 150`; `drawSprite` / `drawFrame` sobre un canvas intermedio                         |
| `assets/spritesheet-breakout.png` | Único spritesheet (paddle, pelota, bloques, 4 frames de explosión por color)                                                                    |
| `assets/sounds/*.mp3`             | `ball-bounce` y `break-sound`; **no se portan**                                                                                                 |
| `README.md`, `CLAUDE.md`          | Controles, reglas y tabla de niveles                                                                                                            |
| `index.html`, `specs/`            | Canvas 800×600 y specs de la referencia; no se portan                                                                                           |

Análisis de la fuente:

| Aspecto             | Resultado                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Globals y listeners | `paddle`, `ball`, `blocks`, `explosions`, `lives`, `score`, `gameState`, `currentLevel`, `isPaused`, `keys`, `lastTime` (a la clausura); `keydown`/`keyup` en `document`, `mousemove`/`click` en el canvas (a `destroy`) |
| Canvas              | 800×600 interno, igual que Asteroids                                                                                                                                                                                     |
| HUD y overlays      | `Score`, `Nivel` y pelotas de vida dibujados en canvas → pasan a React (Puntuación, Nivel, Vidas); `GAME OVER`, `¡Completaste el juego!` y `PAUSA` se dibujan en canvas                                                  |
| Puntuación          | 10 por bloque; 208 bloques en total (60 + 40 + 30 + 39 + 39) → máximo plausible 2 080                                                                                                                                    |
| Estados             | `playing`, `paused` (flag aparte), `gameover` (vidas = 0), `win` (nivel 5 completado); 3 vidas, 5 niveles, sin saque: la pelota sale moviéndose al cargar nivel y al perder una vida                                     |
| Controles           | `←` / `→` (400 px/s) y ratón sobre el canvas; `P` / `Escape` pausan                                                                                                                                                      |
| Assets              | 1 PNG (se porta), 2 mp3 (fuera de alcance)                                                                                                                                                                               |
| Discrepancias       | `CLAUDE.md` de la referencia dice paddle 162×14 px, pero `game.js` usa `paddle.w = 81` (el sprite de 162 px se dibuja a 81); se porta el código. El texto `long` del catálogo coincide con las reglas reales             |

## Scope

**In:**

- Motor en `lib/games/arkanoid/` (`constants.ts`, `levels.ts`, `utils.ts`, `entities.ts`, `game.ts`) con `createArkanoidGame(canvas, callbacks)` → `{ pause, resume, restart, destroy }`, portando `game.js` y `levels.js` sin cambiar reglas ni números: `PADDLE_SPEED` 400, paddle 81×14 en `y` 560, pelota 16×16 con `BASE_BALL_VX = 200` y `BASE_BALL_VY = −300` × `speed` del nivel, bloques 64×24 en parrilla de 10×6 con origen `(80, 80)`, 10 puntos por bloque, un bloque por frame, 3 vidas, 5 niveles con `speed` `[1.00, 1.10, 1.21, 1.33, 1.46]` y explosión de 150 ms con 4 frames.
- Spritesheet copiado a `public/games/arkanoid/spritesheet-breakout.png` y cargado dentro del motor; el loop arranca al terminar la carga y `destroy()` lo cancela si ocurre durante ella.
- Canvas 800×600 (mismo tamaño que Asteroids): sin cambios de dimensiones en `GameScreen`; solo se añade la entrada de Arkanoid en `GAMES_CONFIG` con `showLives: true` y `showNext: false`.
- Control por teclado (`←` / `→`) y por ratón (`mousemove` sobre el canvas, con escala CSS→canvas), ambos retirados en `destroy()`.
- HUD React: Jugador, Puntuación, Vidas (corazones, hasta 3) y Nivel (1–5 en dos dígitos). El `Score`, el `Nivel` y las pelotas de vida que la referencia dibuja en el canvas **no se portan**.
- Pausa (`P` / `Escape`, `blur`, `visibilitychange`) con overlay `PAUSA` en el canvas, `preventDefault` sobre flechas y `Espacio`, reinicio con `Espacio` en `gameover`.
- Victoria: al romper los bloques del nivel 5 el motor emite `gameover` y dibuja el overlay `¡COMPLETASTE EL JUEGO!` con el puntaje y «ESPACIO PARA REINICIAR».
- Registro en `GAMES_CONFIG` (`components/game/game-screen.tsx`) y en `PLAYABLE_GAME_IDS` (`lib/games.ts`).
- Migración `supabase/migrations/20261031120000_rename_bloque_buster_to_arkanoid.sql`: la fila `bloque-buster` pasa a `arkanoid` / `ARKANOID` conservando portada (`cover-bricks`), color, categoría, textos y `sort_order` 1; sus 10 filas `is_seed` se **borran**.
- Actualizar el nombre «Bloque Buster» en `lib/home.ts` (texto de la tarjeta «JUEGOS CLÁSICOS» y actividad reciente) a «Arkanoid».
- Guardado automático de la puntuación en GAME OVER y en victoria con el `saveScore` existente (sin código de leaderboard nuevo).
- Diseño de los overlays nuevos del canvas (`PAUSA`, `GAME OVER`, victoria) con `/frontend-design`, como exige `CLAUDE.md`, coherentes con los de Asteroids y Tetris.
- Actualizar `CLAUDE.md` (Architecture notes): recuento de filas `is_seed` y nota del juego con assets en `public/games/`.

**Out of scope (para specs futuros):**

- Sonido (`ball-bounce.mp3`, `break-sound.mp3`); los mp3 no se copian.
- Selector de nivel en la pausa (botones 1–5 con clic sobre el canvas).
- Controles táctiles o gamepad.
- Cambios de reglas o balance (incluido el rebote que siempre invierte `vy` al romper un bloque, y la ausencia de saque).
- Auth, anti-trampas y rate limit (heredado del SPEC 06).
- Reescalar o conservar las semillas de `bloque-buster`.
- Cambiar la portada `cover-bricks` o el texto del catálogo.
- Tests automatizados: el repo no tiene test runner.
- Modificar `references/` o `lib/games/asteroids/`.

## Data model

Sin tablas ni columnas nuevas. Cambia una fila de `games` y se borran las filas `is_seed` de `scores` que la referencian. Sin cambios en `lib/games/types.ts`: `GameStatus`, `GameHud` y `GameCallbacks` ya bastan (`dead` no se usa; la victoria se emite como `gameover`).

Configuración en `GameScreen` (entrada nueva, sin tocar las existentes):

```ts
// components/game/game-screen.tsx
// arkanoid: { create: createArkanoidGame, width: 800, height: 600, showLives: true, showNext: false }
```

Estructura del motor:

| Archivo                           | Contenido                                                                                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/games/arkanoid/constants.ts` | `W = 800`, `H = 600`, `PADDLE_SPEED`, `BLOCK_COLS/ROWS/W/H`, `BLOCKS_ORIGIN_X/Y`, `BASE_BALL_VX/VY`, `POINTS_PER_BLOCK = 10`, `INITIAL_LIVES = 3`, `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`, `SPRITESHEET_URL` |
| `lib/games/arkanoid/levels.ts`    | `LEVELS` (5 niveles `{ speed, blocks: { col, row, color }[] }`), generados con la misma lógica que `levels.js`                                                                                                            |
| `lib/games/arkanoid/utils.ts`     | `collideAABB(ball, block)`                                                                                                                                                                                                |
| `lib/games/arkanoid/entities.ts`  | Tipos `Paddle`, `Ball`, `Block`, `Explosion`; `drawSprite(ctx, img, name, x, y, w, h)` y `drawFrame(ctx, img, frame, x, y, w, h)` (reciben la imagen por parámetro, sin globals)                                          |
| `lib/games/arkanoid/game.ts`      | Estado en clausura, carga del spritesheet, `loadLevel`, `update(dt)`, `draw()`, loop, input, pausa, `onHudChange`, `destroy`                                                                                              |

Fila migrada (fragmento ilustrativo; la FK `scores.game_id → games.id` no tiene `ON UPDATE CASCADE` y `sort_order` es `unique`):

```sql
update public.games set sort_order = 0 where id = 'bloque-buster';
insert into public.games (id, title, short, long, category, cover, color, sort_order)
  select 'arkanoid', 'ARKANOID', short, long, category, cover, color, 1 from public.games where id = 'bloque-buster';
delete from public.scores where game_id = 'bloque-buster' and is_seed;
update public.scores set game_id = 'arkanoid' where game_id = 'bloque-buster';
delete from public.games where id = 'bloque-buster';
```

Convenciones:

- Coordenadas: origen arriba a la izquierda; el juego ocupa el canvas completo (800×600).
- La transición a `status: "gameover"` (vidas = 0 o victoria) dispara el guardado en `GameScreen`; el motor no sabe nada de Supabase. La victoria se distingue solo dentro del motor para elegir el texto del overlay.
- El motor emite `score`, `lives` (3 → 0) y `level` (1–5) reales. `onHudChange` solo se invoca si cambia algún campo.
- `dt` se limita a 50 ms; al reanudar, `lastTime` se reinicia (primer `dt` = 0). Es la única diferencia de física con la referencia (que no limita `dt`) y solo afecta a frames detenidos.
- La pausa solo actúa en estado `playing`, como en la referencia. El estado `paused` vuelve a `playing` al reanudar.
- Entradas: `ArrowLeft` / `ArrowRight` mueven la paleta, `mousemove` la centra en el cursor (`mouseX − paddle.w / 2`, acotado a `[0, W − paddle.w]`), `KeyP` / `Escape` alternan pausa, `Space` reinicia en `gameover` (solo en la pulsación inicial, `!e.repeat`). El movimiento con ratón sigue actuando durante la pausa, como en la referencia.
- `Math.random` y `performance.now` no se usan; `requestAnimationFrame` y la carga de la imagen ocurren solo dentro del motor (creado en `useEffect`).
- Sprites: la imagen se dibuja directamente con `drawImage` desde el `HTMLImageElement` cargado (no se replica el canvas intermedio de la referencia, que no cambia el resultado).
- `restart()` rearma `score = 0`, `lives = 3`, `currentLevel = 1`, paleta centrada y nivel 1 cargado.

## Implementation plan

Antes de empezar: leer en `node_modules/next/dist/docs/` lo relativo a Client Components y `useEffect` con `cacheComponents`, a `public/` (assets estáticos) y a `updateTag` / `revalidateTag` para el catálogo cacheado (`cacheTag("games")`). Invocar `/frontend-design` antes del paso 4.

1. **Constantes, niveles y utilidades.** Crear `lib/games/arkanoid/constants.ts`, `levels.ts` y `utils.ts` con los valores y la generación de `levels.js` copiados literalmente. Verificar: `npx tsc --noEmit` pasa y un `console.log` temporal fuera del repo (o inspección con `tsx`) confirma 60, 40, 30, 39 y 39 bloques por nivel.
2. **Asset y entidades.** Copiar `references/04-arkanoid/assets/spritesheet-breakout.png` a `public/games/arkanoid/` (sin mp3 ni otros archivos) y crear `lib/games/arkanoid/entities.ts` con los tipos y los helpers `drawSprite` / `drawFrame`. Verificar: `npx tsc --noEmit` y `npm run lint` pasan, y `/games/arkanoid/spritesheet-breakout.png` responde 200 con el mismo hash que el original.
3. **Motor.** Crear `lib/games/arkanoid/game.ts` con `createArkanoidGame`: estado en clausura, carga del spritesheet (el loop arranca en `onload`; `destroy()` marca el motor como destruido y anula `onload`/`onerror`), `loadLevel`, `update(dt)` (paleta, pelota, rebotes en paredes y paleta, colisión AABB con un bloque por frame, explosiones, pérdida de vida, avance de nivel y victoria), `draw()` sin HUD de texto, loop con `requestAnimationFrame`, teclado en `window`, `mousemove` en el canvas, `onHudChange` y `destroy`. Verificar: `npx tsc --noEmit` y `npm run lint` pasan.
4. **Pausa, foco, overlays y scroll.** Añadir `pause` / `resume`, `P` / `Escape`, overlay `PAUSA`, overlays `GAME OVER` y `¡COMPLETASTE EL JUEGO!` (con puntaje y «ESPACIO PARA REINICIAR», tamaño de fuente que quepa en 800 px), pausa con `blur` y `visibilitychange`, `preventDefault` sobre flechas y `Espacio`, y reinicio con `Espacio` en `gameover`. Verificar: `npx tsc --noEmit` y `npm run lint` pasan.
5. **Catálogo.** Crear `supabase/migrations/20261031120000_rename_bloque_buster_to_arkanoid.sql` y aplicarla con `apply_migration`; invalidar el catálogo cacheado (`cacheTag("games")`). Actualizar «Bloque Buster» → «Arkanoid» en `lib/home.ts`. Verificar con `execute_sql`: `select count(*) from games` = 8, no existe `bloque-buster`, existe `arkanoid` con `sort_order` 1, `select count(*) from scores where is_seed` = 60, `where game_id in ('arkanoid','bloque-buster')` = 0, y `get_advisors` (security) sin avisos nuevos. `git grep -n -i "bloque.buster" -- app lib components` no devuelve resultados.
6. **Registro.** Añadir `arkanoid` a `GAMES_CONFIG` y a `PLAYABLE_GAME_IDS`. Verificar: `/juegos/arkanoid/jugar` muestra el juego, `/juegos/serpentina/jugar` sigue mostrando «JUEGO PRÓXIMAMENTE» y `/juegos/asteroids/jugar` y `/juegos/tetris/jugar` siguen igual.
7. **Guardado y ranking.** Comprobar de punta a punta GAME OVER → `saveScore` → `/juegos/arkanoid` y `/salon`, incluidos los estados con el ranking vacío (`game_stats` sin fila para `arkanoid` antes de la primera partida). Verificar con `execute_sql` y Playwright.
8. **Documentar.** Actualizar `CLAUDE.md`, Architecture notes: filas `is_seed` (60, ya no 70, y los juegos que cubren), `arkanoid` en el punto de `GAMES_CONFIG` y los assets en `public/games/`. Verificar: `git diff` de `CLAUDE.md` muestra solo ese cambio.

## Acceptance criteria

**Build**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] `lib/games/arkanoid/` no importa `react` ni `next/*`.
- [ ] `git grep -nE "^let |^var " -- lib/games` no devuelve resultados.
- [ ] No se modifica ningún archivo de `references/` ni de `lib/games/asteroids/` ni `lib/games/tetris/`.
- [ ] `public/games/arkanoid/` contiene solo `spritesheet-breakout.png`.

**Integración**

- [ ] `/juegos/arkanoid/jugar` muestra el canvas 800×600 con 60 bloques, paleta y pelota dentro del marco CRT.
- [ ] `/juegos/bloque-buster` y `/juegos/bloque-buster/jugar` devuelven 404; `/juegos/arkanoid` muestra el detalle con título ARKANOID y la portada `cover-bricks`.
- [ ] `/juegos/serpentina/jugar` (y los demás no jugables) siguen mostrando «JUEGO PRÓXIMAMENTE»; `/juegos/inexistente/jugar` da 404.
- [ ] `/juegos/asteroids/jugar` y `/juegos/tetris/jugar` se ven y se comportan igual que antes.
- [ ] SALIR navega a `/juegos/arkanoid`.
- [ ] La consola no muestra errores ni avisos de hidratación en `/juegos/arkanoid/jugar`.
- [ ] `/biblioteca` y la sección de juegos del home muestran 8 y 6 juegos, con ARKANOID en la posición 1 y sin duplicado.
- [ ] El home y la actividad reciente muestran «Arkanoid» en lugar de «Bloque Buster».
- [ ] Salir de la ruta mientras el spritesheet carga no deja errores en la consola ni un loop activo.

**Jugabilidad (manual)**

- [ ] `←` y `→` mueven la paleta a 400 px/s y no la sacan del canvas.
- [ ] El ratón sobre el canvas centra la paleta en el cursor, también con el canvas escalado por CSS, y no la saca del canvas.
- [ ] La pelota rebota en las paredes izquierda, derecha y superior y en la paleta (siempre hacia arriba al tocarla desde arriba).
- [ ] Romper un bloque suma exactamente 10 puntos, invierte `vy` de la pelota y lanza una explosión de 4 frames que dura 150 ms.
- [ ] Si la pelota cae por el borde inferior se resta una vida, la pelota reaparece sobre la paleta con la velocidad del nivel y el motor sigue en `playing` mientras queden vidas.
- [ ] Al romper todos los bloques del nivel el nivel sube en 1, se carga su patrón (pirámide, ajedrez, huecos, marco + cruz) y la velocidad pasa a `[1.10, 1.21, 1.33, 1.46]` × (200, −300); las vidas y la puntuación se conservan.
- [ ] Al perder la tercera vida el canvas muestra `GAME OVER` con el puntaje y «ESPACIO PARA REINICIAR».
- [ ] Al romper todos los bloques del nivel 5 el canvas muestra `¡COMPLETASTE EL JUEGO!` con el puntaje y «ESPACIO PARA REINICIAR», el HUD pasa a `gameover` y la puntuación se guarda.
- [ ] `Espacio` en `gameover` reinicia con puntuación 0, 3 vidas, nivel 1 y los 60 bloques del nivel 1.
- [ ] No existe el selector de nivel en la pausa: el overlay `PAUSA` no tiene botones.

**HUD React**

- [ ] Puntuación, Vidas y Nivel coinciden con el estado del juego; el nivel se muestra con dos dígitos (`01`–`05`) y las vidas como corazones (3 → 0, mostrando `—` con 0).
- [ ] El canvas no dibuja `Score`, `Nivel` ni pelotas de vida.
- [ ] Jugador muestra el nombre de la sesión mock o `INVITADO`.
- [ ] `onHudChange` solo se invoca cuando cambia un campo (comprobable con un `console.count` temporal que se retira antes de cerrar).

**Pausa, foco y teclado**

- [ ] `P` y `Escape` pausan y reanudan; en pausa la pelota no se mueve y el canvas muestra `PAUSA`.
- [ ] Tras reanudar, la pelota no salta: el primer `dt` es 0.
- [ ] Cambiar de pestaña o quitar el foco a la ventana pausa el juego; volver no lo reanuda solo.
- [ ] Con el juego montado, flechas y `Espacio` no desplazan la página.
- [ ] Al salir de la ruta con SALIR o con el botón atrás ya no responden teclado ni ratón, y volver a entrar inicia una partida nueva; el doble efecto de React 19 no duplica la velocidad de la pelota ni el movimiento de la paleta.

**Guardado y leaderboard**

- [ ] Con sesión mock, un GAME OVER con puntuación mayor que 0 inserta exactamente una fila en `scores` con `game_id = 'arkanoid'`, el nombre de la sesión y esa puntuación.
- [ ] La barra del marco muestra `GUARDANDO` y después `GUARDADO #N`, donde `N` coincide con el rango en `/salon`.
- [ ] Reiniciar con `Espacio` y volver a perder inserta una segunda fila; pausar, reanudar o redibujar no inserta filas extra.
- [ ] Una puntuación 0 no llama a `saveScore`; sin sesión aparece «INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN» con enlace a `/auth` y no se inserta nada.
- [ ] Si el guardado falla se muestra `ERROR` con `REINTENTAR` y el juego sigue operativo.
- [ ] La fila guardada aparece en `/juegos/arkanoid` y en `/salon` sin reiniciar el servidor; la primera partida real ocupa el puesto #1.
- [ ] Antes de jugar, `/juegos/arkanoid` y `/salon` se renderizan sin errores con el ranking de Arkanoid vacío (sin semillas), y la tarjeta del juego muestra `best` 0 y `plays` 0.
- [ ] La puntuación máxima posible (2 080) es menor que `SCORE_LIMITS.maxScore` (9 999 999).

**Base de datos**

- [ ] `select count(*) from games` devuelve 8 y no existe ninguna fila con `id = 'bloque-buster'`.
- [ ] `select count(*) from scores where is_seed` devuelve 60 y `where game_id = 'bloque-buster'` devuelve 0.
- [ ] Existe `supabase/migrations/20261031120000_rename_bloque_buster_to_arkanoid.sql` y `list_migrations` la muestra aplicada.
- [ ] `get_advisors` (security) no reporta avisos nuevos.

**Visual (manual)**

- [ ] A 1440×900 y a 1366×650 el canvas se ve completo (pantalla y barra inferior del marco) sin scroll vertical, manteniendo 4:3.
- [ ] A 390×844 el canvas no desborda horizontalmente y el juego se ve completo (solo teclado y ratón).
- [ ] Los overlays `PAUSA`, `GAME OVER` y `¡COMPLETASTE EL JUEGO!` son legibles sobre los bloques y caben dentro de los 800 px del canvas.
- [ ] Los sprites (paleta, pelota, bloques de 7 colores y explosiones) se ven nítidos y con los mismos colores que en `references/04-arkanoid/index.html`.

**Sin efectos colaterales**

- [ ] Ninguna clave secreta ni `service_role` en el repo.
- [ ] `git status` lista solo `lib/games/arkanoid/`, `lib/games.ts`, `lib/home.ts`, `components/game/`, `public/games/arkanoid/`, `supabase/migrations/`, `CLAUDE.md` y este spec.

## Decisions

- **Sí:** id `arkanoid`. Decisión del usuario; el juego se llama Arkanoid, igual que se renombró `caida` a `tetris`. La URL pasa a `/juegos/arkanoid`; no hay enlaces externos que romper porque la app aún no está publicada.
- **No:** mantener `bloque-buster` como id. Evitaba la migración, pero el id no coincidiría con la carpeta de la referencia ni con el nombre del juego.
- **Sí:** renombrar la fila con una migración (insertar, borrar semillas, mover puntuaciones reales, borrar la antigua). Un solo Arkanoid en el catálogo, sin duplicados en biblioteca ni salón. Se mueven también las filas no semilla por si alguien insertó puntuaciones con la API pública antes de que el juego fuera jugable.
- **Sí:** conservar `cover-bricks`, color, categoría y textos del catálogo. La clase de portada es CSS (SPEC 06) y no se renombra; el `long` coincide con las reglas reales.
- **Sí:** borrar las 10 semillas de `bloque-buster`. Decisión del usuario. Valen 37 347–230 564 y el máximo real es 2 080, así que ninguna partida entraría en el TOP 10. El ranking arranca vacío y la primera partida real es el #1.
- **No:** reescalar las semillas a un rango alcanzable ni conservarlas tal cual. Reescalar inventa datos; conservarlas deja el ranking inalcanzable (el caso de Tetris sí es alcanzable: máximo observado ≈ 300 000 frente a 9 999 999).
- **Sí:** sin sonido. Decisión del usuario; Asteroids y Tetris no tienen y los mp3 añaden carga de audio y política de autoplay. No se copian a `public/`.
- **Sí:** sin selector de nivel en la pausa. Decisión del usuario; es un atajo de desarrollo que permite saltar niveles y distorsiona el ranking. La pausa queda como la de Asteroids y Tetris. Elimina también el listener de `click` del canvas.
- **Sí:** victoria como `gameover` con overlay propio. Decisión del usuario; no se amplía `GameStatus`, así que Asteroids, Tetris y la lógica de guardado de `GameScreen` no se tocan, y completar el juego guarda la puntuación como cualquier partida. La barra del marco mostrará «FIN DE PARTIDA».
- **No:** añadir el estado `win` a `GameStatus`. Obligaría a tocar el LED, el guardado y los otros dos motores.
- **Sí:** canvas 800×600 sin cambios en `GameScreen`. Las constantes de física y colisión están en píxeles de ese tamaño; solo se añade una entrada en `GAMES_CONFIG`.
- **Sí:** HUD en React (Puntuación, Vidas, Nivel) y el canvas solo dibuja la escena. Es el patrón del SPEC 05; se descartan las pelotas de vida dibujadas en canvas.
- **Sí:** portar el ratón. Es un control original (`README.md`) y mejora mucho la jugabilidad; el listener se retira en `destroy()`.
- **Sí:** portar el comportamiento de la referencia aunque sea mejorable (pelota en movimiento al cargar nivel, `vy` siempre invertida al romper un bloque, un bloque por frame, paleta de 81 px). El spec adapta, no rebalancea.
- **Sí:** spritesheet en `public/games/arkanoid/` y cargado dentro del motor con `HTMLImageElement`. Sigue el criterio de binarios en `public/games/<id>/` y evita imports de assets desde `lib/` (el motor no importa `next/*`).
- **No:** replicar el canvas intermedio que `spritesheet.js` crea al cargar. Duplica la imagen en memoria sin cambiar el dibujo.
- **Sí:** limitar `dt` a 50 ms. Cumple el contrato del motor; la pausa automática ya cubre perder el foco.
- **Sí:** reiniciar con `Espacio` en `gameover`. La referencia no tiene reinicio; el contrato del motor y los otros juegos lo exigen.
- **Sí:** validación manual más consultas SQL y `git grep`. Sin test runner en el repo.

## Risks

| Riesgo                                                                                                                   | Mitigación                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| React 19 ejecuta `useEffect` dos veces en desarrollo y puede duplicar loop, listeners o la carga del spritesheet         | `destroy()` cancela `requestAnimationFrame`, retira cada listener con la misma referencia y anula la carga pendiente; criterios sobre el doble efecto y sobre salir durante la carga |
| El motor arranca el loop tras `onload` y el componente ya se desmontó                                                    | Bandera `destroyed` en la clausura; `onload` no inicia el loop si está activa                                                                                                        |
| Ranking vacío: `game_stats` no tiene fila para `arkanoid` y alguna vista o consulta asume al menos un registro           | Criterio de aceptación sobre `/juegos/arkanoid`, biblioteca y `/salon` sin semillas; paso 7 lo verifica antes de cerrar                                                              |
| La migración falla a medias y deja `scores` apuntando a una fila inexistente                                             | La FK impide dejar huérfanos; orden apartar → insertar → borrar semillas → mover → borrar, en una sola migración (transaccional)                                                     |
| `sort_order` es `unique` y choca al insertar `arkanoid` con el valor 1                                                   | Se mueve primero `bloque-buster` a `sort_order = 0`, ya dentro de la migración                                                                                                       |
| El borrado de semillas es irreversible                                                                                   | Acotado por `game_id = 'bloque-buster' and is_seed`; verificación del recuento (60) tras aplicarla. Las semillas siguen en la migración `create_scores` si se quisieran recuperar    |
| El catálogo cacheado (`use cache`, `cacheTag("games")`) sigue sirviendo `bloque-buster` tras la migración                | Invalidar el tag o reiniciar el servidor tras aplicarla; criterio de aceptación sobre `/juegos/bloque-buster` con 404                                                                |
| `mousemove` con el canvas escalado por CSS desplaza la paleta respecto al cursor                                         | Convertir con `canvas.width / rect.width` como la referencia; criterio de aceptación con el marco escalado                                                                           |
| El overlay `¡COMPLETASTE EL JUEGO!` a `bold 64px monospace` mide más de 800 px y se corta                                | El tamaño de fuente se ajusta para que quepa (única diferencia visual con la referencia); criterio visual                                                                            |
| El mock de actividad reciente del home conserva una puntuación de 28 450 para «Arkanoid» (inalcanzable en el juego real) | Solo se cambia el nombre; los datos mock del home se tratan en otro spec                                                                                                             |
| Rotura de bloques por tunneling a dt altos (la referencia no limita `dt`)                                                | El límite de 50 ms del contrato lo reduce; la velocidad máxima es 1.46 × 300 px/s, menos de 22 px por frame, inferior al alto de bloque (24 px) y de la pelota (16 px)               |
| Una puntuación mayor que `SCORE_LIMITS.maxScore` haría fallar el guardado                                                | Máximo posible 2 080; sin riesgo                                                                                                                                                     |

## What is **not** in this spec

- Sonido y música (los mp3 de la referencia).
- Selector de nivel en la pausa.
- Controles táctiles o gamepad.
- Cambios de reglas o balance respecto de `references/04-arkanoid`.
- Reescalar o conservar las semillas de `bloque-buster`.
- Auth, anti-trampas y rate limit.
- Nuevo estado `win` en `GameStatus`.
- Tests automatizados.
- Cambios a `references/`.

Cada uno de estos puntos, si se aborda, va en su propio spec.
