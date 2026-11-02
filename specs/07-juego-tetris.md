# SPEC 07 — Juego TETRIS jugable con leaderboard

> **Status:** approved
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-10-29
> **Objective:** Portar `references/03-tetris` a un motor TypeScript en `lib/games/tetris/`, montarlo en `/juegos/tetris/jugar` con un canvas 300×600 parametrizado y guardar su puntuación en el leaderboard existente, renombrando la fila `caida` del catálogo a `tetris`.

---

## Por qué existe este spec

El SPEC 05 portó Asteroids y fijó el patrón (motor sin React + `GameScreen`); el SPEC 06 hizo genérico el catálogo y el guardado de puntuaciones por `game_id`. Tetris es el primer juego que **no encaja tal cual** en ese patrón: el canvas es vertical (300×600, no 800×600), no tiene vidas, necesita mostrar la pieza SIGUIENTE y el catálogo ya lo contiene con otro id (`caida`, «CAÍDA», con 10 filas semilla).

`references/03-tetris/game.js` (~300 líneas) está escrito con globals, `getElementById`, overlays HTML, un tema claro/oscuro en `localStorage` y un `keydown` que nunca se retira. Eso no funciona en el App Router (montaje doble de React 19, navegación cliente, scroll con flechas y Espacio).

Archivos de referencia en `references/03-tetris/`:

| Archivo      | Contenido relevante                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `game.js`    | Constantes (`COLS`, `ROWS`, `BLOCK`, `COLORS`, `PIECES`, `LINE_SCORES`), tablero, rotación con kicks, `clearLines`, ghost, hard/soft drop, loop, input |
| `README.md`  | Controles, reglas y tabla de puntuación                                                                                                                |
| `CLAUDE.md`  | Resumen de arquitectura y fórmulas (`dropInterval`, nivel)                                                                                             |
| `index.html` | Dos canvas (`#board` 300×600, `#next-canvas` 120×120) y panel lateral; no se porta                                                                     |
| `style.css`  | Tema retro y variable `--grid-line`; no se porta (solo se copia el color `#22222e`)                                                                    |

Discrepancia conocida: el README habla de **7 piezas** estándar, pero `randomPiece()` elige entre **8** (`Math.floor(Math.random() * 8) + 1`), incluida la pieza N («tuerca» 3×3 con hueco, gris). Se porta el comportamiento del código.

## Scope

**In:**

- Motor en `lib/games/tetris/` (`constants.ts`, `utils.ts`, `entities.ts`, `game.ts`) con `createTetrisGame(canvas, callbacks)` → `{ pause, resume, restart, destroy }`, portando `game.js` sin cambiar reglas ni números: tablero 10×20, `BLOCK` 30, 8 piezas, rotación horaria con kicks `[0, -1, 1, -2, 2]`, ghost a `globalAlpha` 0.2, soft drop +1 por fila, hard drop +2 por celda, `LINE_SCORES = [0, 100, 300, 500, 800]` × nivel, nivel = `floor(líneas / 10) + 1`, `dropInterval = max(100, 1000 − (nivel − 1) × 90)` ms.
- Canvas del tablero de 300×600 dibujado por el motor, con overlays `PAUSA` y `GAME OVER` (puntaje y «ESPACIO PARA REINICIAR») dibujados en el canvas.
- Pieza SIGUIENTE: el motor emite la forma siguiente por un callback opcional y `GameScreen` la dibuja en un segundo `<canvas>` 120×120 del panel lateral (el motor sigue recibiendo un solo canvas).
- Parametrizar `GameScreen`: tamaño del canvas, visibilidad de la casilla «Vidas» y panel lateral por juego, sin cambiar el aspecto ni el comportamiento de Asteroids.
- HUD React para Tetris: Jugador, Puntuación y Nivel; **sin** casilla de Vidas.
- Pausa (`P` / `Escape`, `blur`, `visibilitychange`), `preventDefault` sobre flechas y `Espacio`, reinicio con `Espacio` en `gameover`.
- Registro en `ENGINES` (`components/game/game-screen.tsx`) y en `PLAYABLE_GAME_IDS` (`lib/games.ts`).
- Migración `supabase/migrations/<timestamp>_rename_caida_to_tetris.sql`: la fila `caida` pasa a `tetris` / `TETRIS` conservando portada (`cover-tetro`), color, categoría, textos y `sort_order`, y sus 10 filas semilla pasan a `game_id = 'tetris'`.
- Guardado automático de la puntuación en GAME OVER con el `saveScore` existente (sin código de leaderboard nuevo).
- Diseño de la UI nueva (marco vertical, panel lateral, canvas «siguiente») con `/frontend-design`, como exige `CLAUDE.md`.
- Actualizar `CLAUDE.md` (Architecture notes) con el canvas parametrizable.

**Out of scope (para specs futuros):**

- Interruptor de tema claro/oscuro con `localStorage` (`tetris-theme`) de la referencia.
- Sonido y música (la referencia no tiene).
- Controles táctiles o gamepad.
- Mostrar el contador de líneas en el HUD (el nivel ya deriva de ellas).
- Mostrar la lista de controles en pantalla.
- Cambios de reglas o balance (incluida la pieza N: se mantiene).
- Auth, anti-trampas y rate limit (heredado del SPEC 06).
- Portar Arkanoid.
- Tests automatizados: el repo no tiene test runner.
- Modificar `references/` o `lib/games/asteroids/` (salvo lo mínimo de `GameScreen` descrito en el plan).

## Data model

Sin tablas ni columnas nuevas. Solo cambia una fila de `games` y las filas `is_seed` de `scores` que la referencian.

Extensión mínima y compatible de `lib/games/types.ts`:

```ts
// lib/games/types.ts  (añadir; Asteroids no lo usa)
export type NextShape = number[][]; // matriz de la pieza; 0 = vacío, 1..8 = índice de color

export type GameCallbacks = {
  onHudChange: (hud: GameHud) => void;
  onNextChange?: (shape: NextShape) => void; // solo cuando cambia la pieza siguiente
};
```

Configuración por juego en `GameScreen` (sustituye al mapa de fábricas):

```ts
// components/game/game-screen.tsx
type GameConfig = {
  create: (canvas: HTMLCanvasElement, callbacks: GameCallbacks) => GameInstance;
  width: number; // resolución interna del canvas
  height: number;
  showLives: boolean;
  showNext: boolean; // renderiza el panel lateral con el canvas 120×120
};
// asteroids: { create: createAsteroidsGame, width: 800, height: 600, showLives: true,  showNext: false }
// tetris:    { create: createTetrisGame,    width: 300, height: 600, showLives: false, showNext: true  }
```

Estructura del motor:

| Archivo                         | Contenido                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/games/tetris/constants.ts` | `COLS = 10`, `ROWS = 20`, `BLOCK = 30`, `COLORS` (índices 1–8), `PIECES` (8 matrices), `LINE_SCORES`, `GRID_LINE = "#22222e"`                                            |
| `lib/games/tetris/utils.ts`     | `createBoard`, `rotateCW`                                                                                                                                                |
| `lib/games/tetris/entities.ts`  | Tipo `Piece` (`{ type, shape, x, y }`), `randomPiece`, `drawBlock(ctx, x, y, colorIndex, size, alpha?)`                                                                  |
| `lib/games/tetris/game.ts`      | Estado en clausura, `collide`, `tryRotate`, `merge`, `clearLines`, `ghostY`, drops, `update(dt)`, `draw()`, loop, input, pausa, `onHudChange`, `onNextChange`, `destroy` |

Migración (fragmento ilustrativo; la FK `scores.game_id → games.id` no tiene `ON UPDATE CASCADE`, así que se mueve en orden):

```sql
update public.games set sort_order = 0 where id = 'caida';
insert into public.games (id, title, short, long, category, cover, color, sort_order)
  select 'tetris', 'TETRIS', short, long, category, cover, color, 2 from public.games where id = 'caida';
update public.scores set game_id = 'tetris' where game_id = 'caida';
delete from public.games where id = 'caida';
```

Convenciones:

- Coordenadas: origen arriba a la izquierda; el tablero ocupa el canvas completo (300×600).
- La transición a `status: "gameover"` dispara el guardado en `GameScreen`; el motor no sabe nada de Supabase.
- El motor emite `lives: 0` (la casilla Vidas está oculta) y `level` real.
- `onHudChange` solo se invoca si cambia `score`, `level` o `status`; `onNextChange` solo si cambia la pieza siguiente.
- `dt` se limita a 50 ms; al reanudar, `lastTime` se reinicia (primer `dt` = 0). Es la única diferencia con la referencia y solo afecta a frames detenidos.
- Entradas idénticas a la referencia: `ArrowLeft` / `ArrowRight` mueven, `ArrowDown` soft drop, `ArrowUp` o `KeyX` rotan, `Space` hard drop (y reinicia en `gameover`), `KeyP` / `Escape` alternan pausa. Las repeticiones del sistema (`e.repeat`) siguen actuando en movimiento, soft drop, rotación y hard drop, como en la referencia; solo la pausa las ignora.
- Colores de piezas (`COLORS`) copiados literalmente; la pieza N usa `#9e9e9e`.

## Implementation plan

Antes de empezar: leer en `node_modules/next/dist/docs/` lo relativo a Client Components y `useEffect` con `cacheComponents`, y a `updateTag` / `revalidateTag` para el catálogo cacheado (`cacheTag("games")`). Invocar `/frontend-design` antes del paso 6.

1. **Tipos, constantes y utilidades.** Añadir `NextShape` y `onNextChange?` a `lib/games/types.ts`; crear `lib/games/tetris/constants.ts` y `utils.ts`. Verificar: `npx tsc --noEmit` pasa y Asteroids compila sin cambios.
2. **Entidades.** Crear `lib/games/tetris/entities.ts` con `Piece`, `randomPiece` y `drawBlock`. Verificar: `npx tsc --noEmit` y `npm run lint` pasan.
3. **Motor.** Crear `lib/games/tetris/game.ts` con `createTetrisGame`: estado en clausura, `collide`, rotación con kicks, `merge`, `clearLines` (puntos, líneas, nivel, `dropInterval`), ghost, soft/hard drop, `spawn` (que termina la partida si la pieza no cabe), `draw` con rejilla `GRID_LINE`, loop con `requestAnimationFrame`, `onHudChange`, `onNextChange` y `destroy`. Verificar: `npx tsc --noEmit` y `npm run lint` pasan.
4. **Pausa, foco y scroll.** Añadir `pause` / `resume`, `P` / `Escape`, overlay `PAUSA`, overlay `GAME OVER` con puntaje, pausa con `blur` y `visibilitychange`, `preventDefault` sobre flechas y `Espacio`, y reinicio con `Espacio` en `gameover`. Verificar: `npx tsc --noEmit` y `npm run lint` pasan.
5. **Parametrizar `GameScreen`.** Sustituir `ENGINES` por `GAMES_CONFIG` con `GameConfig` (tamaño, `showLives`, `showNext`); el `<canvas>` toma `width` / `height` de la config; añadir estado y canvas «siguiente» (120×120, dibujado desde `NextShape` con `COLORS` y `drawBlock`), sin registrar todavía Tetris. Verificar: `npx tsc --noEmit` y `npm run lint` pasan, y `/juegos/asteroids/jugar` se ve y juega igual que antes.
6. **Marco vertical y panel lateral.** Con `/frontend-design`, estilos nuevos en `app/globals.css` (prefijo `av-` en cada `@keyframes`) para el marco CRT con proporción 1:2, el panel de pieza siguiente y la casilla de Vidas oculta; el marco se limita por `100dvh` sin scroll vertical. Verificar: `npm run build` pasa.
7. **Catálogo.** Crear `supabase/migrations/<timestamp>_rename_caida_to_tetris.sql` y aplicarla con `apply_migration`; invalidar el catálogo cacheado (`cacheTag("games")`). Verificar con `execute_sql`: `select count(*) from games` = 8, no existe `caida`, existe `tetris` con `sort_order` 2, `count(*) from scores where game_id = 'tetris' and is_seed` = 10 y `get_advisors` (security) sin avisos nuevos.
8. **Registro.** Añadir `tetris` a `GAMES_CONFIG` y a `PLAYABLE_GAME_IDS`. Verificar: `/juegos/tetris/jugar` muestra el juego y `/juegos/bloque-buster/jugar` sigue mostrando «JUEGO PRÓXIMAMENTE».
9. **Documentar.** Actualizar en `CLAUDE.md`, Architecture notes, el punto de `lib/games/` y `GameScreen` (config por juego, canvas parametrizable, `onNextChange`). Verificar: `git diff` de `CLAUDE.md` muestra solo ese cambio.

## Acceptance criteria

**Build**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] `lib/games/tetris/` no importa `react` ni `next/*`.
- [ ] `git grep -nE "^let |^var " -- lib/games` no devuelve resultados.
- [ ] No se modifica ningún archivo de `references/` ni de `lib/games/asteroids/`.

**Integración**

- [ ] `/juegos/tetris/jugar` muestra el tablero 10×20 con una pieza cayendo, dentro del marco CRT vertical, y a su lado el panel con la pieza siguiente.
- [ ] `/juegos/caida` y `/juegos/caida/jugar` devuelven 404; `/juegos/tetris` muestra el detalle con título TETRIS y la portada `cover-tetro`.
- [ ] `/juegos/bloque-buster/jugar` (y los demás no jugables) siguen mostrando «JUEGO PRÓXIMAMENTE»; `/juegos/inexistente/jugar` da 404.
- [ ] `/juegos/asteroids/jugar` se ve y se comporta igual que antes (800×600, con Vidas).
- [ ] SALIR navega a `/juegos/tetris`.
- [ ] La consola no muestra errores ni avisos de hidratación en `/juegos/tetris/jugar`.
- [ ] `/biblioteca` y la sección de juegos del home muestran 8 y 6 juegos, con TETRIS en la posición 2 y sin duplicado.

**Jugabilidad (manual)**

- [ ] `←` y `→` mueven la pieza una columna y no la sacan del tablero.
- [ ] `↑` y `X` rotan en sentido horario; pegada a una pared, la rotación se desplaza con el kick (`0, -1, 1, -2, 2`) en vez de bloquearse cuando cabe.
- [ ] `↓` baja una fila y suma 1 punto; `Espacio` baja hasta el fondo, suma 2 puntos por celda recorrida y bloquea la pieza.
- [ ] La pieza fantasma se dibuja con opacidad 0,2 donde aterrizará la pieza actual.
- [ ] Una, dos, tres y cuatro líneas a la vez suman 100, 300, 500 y 800 multiplicado por el nivel vigente.
- [ ] El nivel sube cada 10 líneas y la caída se acelera según `max(100, 1000 − (nivel − 1) × 90)` ms.
- [ ] Aparecen las 8 piezas, incluida la N gris 3×3 con hueco.
- [ ] Si la pieza nueva no cabe al aparecer, la partida termina y el canvas muestra `GAME OVER` con el puntaje y «ESPACIO PARA REINICIAR»; `Espacio` reinicia con puntuación 0, nivel 1 y tablero vacío.

**HUD React**

- [ ] Puntuación y Nivel coinciden con el estado del juego; el nivel se muestra con dos dígitos (`01`).
- [ ] La casilla «Vidas» no aparece en Tetris y sigue apareciendo en Asteroids.
- [ ] El canvas «siguiente» muestra la pieza que saldrá después y se actualiza al bloquear cada pieza; no se redibuja entre bloqueos.
- [ ] Jugador muestra el nombre de la sesión mock o `INVITADO`.
- [ ] `onHudChange` solo se invoca cuando cambia un campo (comprobable con un `console.count` temporal que se retira antes de cerrar).

**Pausa, foco y teclado**

- [ ] `P` y `Escape` pausan y reanudan; en pausa nada cae y el canvas muestra `PAUSA`.
- [ ] Tras reanudar, la pieza no salta: el primer `dt` es 0.
- [ ] Cambiar de pestaña o quitar el foco a la ventana pausa el juego; volver no lo reanuda solo.
- [ ] Con el juego montado, flechas y `Espacio` no desplazan la página.
- [ ] Al salir de la ruta con SALIR o con el botón atrás ya no responde el teclado, y volver a entrar inicia una partida nueva; el doble efecto de React 19 no duplica la velocidad de caída ni los movimientos.

**Guardado y leaderboard**

- [ ] Con sesión mock, un GAME OVER con puntuación mayor que 0 inserta exactamente una fila en `scores` con `game_id = 'tetris'`, el nombre de la sesión y esa puntuación.
- [ ] La barra del marco muestra `GUARDANDO` y después `GUARDADO #N`, donde `N` coincide con el rango en `/salon`.
- [ ] Reiniciar con `Espacio` y volver a perder inserta una segunda fila; pausar, reanudar o redibujar no inserta filas extra.
- [ ] Una puntuación 0 no llama a `saveScore`; sin sesión aparece «INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN» con enlace a `/auth` y no se inserta nada.
- [ ] Si el guardado falla se muestra `ERROR` con `REINTENTAR` y el juego sigue operativo.
- [ ] La fila guardada aparece en `/juegos/tetris` y en `/salon` sin reiniciar el servidor.
- [ ] `/juegos/tetris` muestra el TOP 10 con las 10 filas semilla heredadas de `caida` (mismos nombres y puntuaciones) antes de jugar.

**Base de datos**

- [ ] `select count(*) from games` devuelve 8 y no existe ninguna fila con `id = 'caida'`.
- [ ] `select count(*) from scores where is_seed` sigue devolviendo 70, y `where game_id = 'caida'` devuelve 0.
- [ ] Existe `supabase/migrations/*_rename_caida_to_tetris.sql` y `list_migrations` la muestra aplicada.
- [ ] `get_advisors` (security) no reporta avisos nuevos.

**Visual (manual)**

- [ ] A 1440×900 y a 1366×650 el marco con tablero y panel se ve completo, sin scroll vertical y manteniendo la proporción 1:2 del tablero.
- [ ] A 390×844 no hay desborde horizontal y el tablero se ve completo (solo teclado).
- [ ] Los overlays `GAME OVER` y `PAUSA` son legibles sobre el tablero.

**Sin efectos colaterales**

- [ ] Ninguna clave secreta ni `service_role` en el repo.
- [ ] `git status` lista solo `lib/games/tetris/`, `lib/games/types.ts`, `lib/games.ts`, `components/game/`, `app/globals.css`, `supabase/migrations/`, `CLAUDE.md` y este spec.

## Decisions

- **Sí:** id `tetris`. Decisión del usuario; la URL pasa a `/juegos/tetris`. No hay enlaces externos que romper porque la app aún no está publicada.
- **Sí:** renombrar `caida` → `tetris` con una migración (insertar, mover semillas, borrar). Un solo Tetris en el catálogo y se conservan las 10 semillas.
- **No:** dejar `caida` y añadir `tetris` como fila aparte. Duplicaría el juego en biblioteca y salón.
- **No:** insertar `tetris` y borrar `caida` con sus semillas. Dejaría el ranking vacío sin necesidad; `is_seed` ya permite borrarlas más adelante.
- **Sí:** insertar la fila nueva antes de mover las semillas y borrar la antigua después. La FK `scores.game_id → games.id` no tiene `ON UPDATE CASCADE`, y `sort_order` es `unique`.
- **Sí:** conservar `cover-tetro`, color, categoría y textos del catálogo. Las clases de portada siguen siendo CSS (SPEC 06) y no se renombran.
- **Sí:** canvas 300×600 parametrizado en `GameScreen` mediante `GameConfig`. Decisión del usuario; conserva la resolución interna de la referencia (`BLOCK` = 30), por lo que las constantes no cambian.
- **No:** dibujar el tablero dentro de un canvas 800×600 con la pieza siguiente a un lado. Evitaba tocar `GameScreen`, pero el usuario prefirió el canvas vertical.
- **Sí:** pieza siguiente dibujada en React en un segundo canvas, alimentada por `onNextChange`. El motor sigue recibiendo un solo canvas y `createXGame(canvas, callbacks)` no cambia de firma.
- **No:** pasar un segundo canvas al motor. Cambiaría el contrato compartido de la fábrica.
- **Sí:** ocultar la casilla «Vidas». Decisión del usuario; Tetris no tiene vidas.
- **No:** mostrar líneas en lugar de Vidas. Añadiría una etiqueta específica por juego; el nivel ya resume el progreso.
- **Sí:** portar las 8 piezas como en `game.js`, incluida la N. El spec no cambia reglas; la discrepancia con el README queda documentada.
- **Sí:** entradas con repetición del sistema, igual que la referencia. Cambiarlo es rebalancear.
- **Sí:** limitar `dt` a 50 ms. Cumple el contrato del motor; solo afecta a frames detenidos y la pausa automática ya cubre perder el foco.
- **No:** portar el interruptor de tema y su `localStorage`. La plataforma ya tiene su propio estilo y la referencia usa una clave que habría que migrar.
- **Sí:** color de rejilla fijo `#22222e` (valor del tema oscuro de la referencia) en vez de leer una variable CSS en cada frame.
- **Sí:** validación manual más consultas SQL y `git grep`. Sin test runner en el repo.

## Risks

| Riesgo                                                                                                                              | Mitigación                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| React 19 ejecuta `useEffect` dos veces en desarrollo y puede duplicar loop y listeners                                              | `destroy()` cancela `requestAnimationFrame` y retira cada listener con la misma referencia; criterio de aceptación sobre el doble efecto |
| Parametrizar `GameScreen` rompe Asteroids                                                                                           | Config de Asteroids idéntica a los valores actuales (800×600, con Vidas); paso 5 se verifica contra Asteroids antes de registrar Tetris  |
| La migración falla a medias y deja `scores` apuntando a una fila inexistente                                                        | La FK impide dejar huérfanos; el orden es insertar → mover → borrar y se aplica en una sola migración (transaccional)                    |
| `sort_order` es `unique` y choca al insertar `tetris` con el valor 2                                                                | Se mueve primero `caida` a `sort_order = 0`, ya dentro de la migración                                                                   |
| El catálogo cacheado (`use cache`, `cacheTag("games")`) sigue sirviendo `caida` tras la migración                                   | Invalidar el tag o reiniciar el servidor tras aplicarla; criterio de aceptación sobre `/juegos/caida` con 404                            |
| Un marco vertical no cabe en notebooks bajas (1366×650) y fuerza scroll                                                             | Limitar el marco por `100dvh` (diseño con `/frontend-design`); criterio visual a 1366×650                                                |
| Rotación con kicks distinta a la original por reescritura de `tryRotate`                                                            | Constantes y orden de kicks copiados literalmente; checklist de jugabilidad                                                              |
| Hard drop con `Espacio` mantenido descarta piezas en cadena (comportamiento heredado) y el `Espacio` también reinicia en `gameover` | Reiniciar solo en la pulsación inicial en `gameover` (`!e.repeat`); aceptado en juego normal por fidelidad a la referencia               |
| Una puntuación mayor que `SCORE_LIMITS.maxScore` (9 999 999) haría fallar el guardado                                               | Máximo observado en semillas ≈ 300 000; con el nivel 11 la velocidad se estanca. Si apareciera, se amplía el límite en otro spec         |
| Hidratación: aleatoriedad (`randomPiece`) o `performance.now` durante el render                                                     | Todo su uso ocurre dentro del motor, creado en `useEffect`; el canvas «siguiente» solo se dibuja en un efecto                            |

## What is **not** in this spec

- Interruptor de tema claro/oscuro de la referencia.
- Sonido, música, controles táctiles o gamepad.
- Contador de líneas en el HUD y lista de controles en pantalla.
- Cambios de reglas o balance (incluida la pieza N).
- Auth, anti-trampas y rate limit.
- Arkanoid.
- Tests automatizados.
- Cambios a `references/`.

Cada uno de estos puntos, si se aborda, va en su propio spec.
