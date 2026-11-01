# SPEC 09 — Juego SERPENTINA jugable con leaderboard

> **Status:** approved
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 08
> **Date:** 2026-11-01
> **Objective:** Crear `serpentina` como motor TypeScript en `lib/games/serpentina/` (Snake clásico con paredes que se atraviesan), montarlo en `/juegos/serpentina/jugar` (canvas 800×600) y guardar su puntuación en el leaderboard existente.

---

## Por qué existe este spec

Serpentina es el primer juego **desde cero**: no hay carpeta en `references/`, así que no hay código que adaptar y las reglas las fija este spec. Reutiliza el patrón ya probado en los SPEC 05–08: motor sin React (`lib/games/<id>/`) y `GameScreen` parametrizado con `GAMES_CONFIG` (SPEC 07), más el catálogo y `saveScore` genéricos por `game_id` (SPEC 06).

Lo que distingue a Serpentina de los juegos anteriores:

- **Movimiento por pasos sobre una rejilla**, no por física continua: el loop corre a `requestAnimationFrame`, pero la serpiente solo avanza cuando un acumulador de tiempo supera el intervalo de paso, que baja con el nivel.
- **Sin vidas**: el HUD oculta Vidas (`showLives: false`, como Tetris) y muestra el nivel real.
- **Aleatoriedad en el motor**: la posición de cada núcleo usa `Math.random` dentro de la clausura (permitido por el contrato; nunca en el render de React).
- La fila `serpentina` **ya existe** en `games` (no jugable, `cover-snake`, color `green`, `sort_order` 3) con 10 filas `is_seed` (38 387–213 991) que este spec borra.

Análisis de la fuente (juego nuevo, reglas cerradas con el usuario):

| Aspecto             | Resultado                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivos útiles     | Ninguno: no existe referencia. Se escribe `lib/games/serpentina/` desde cero                                                                                                                            |
| Globals y listeners | Estado en la clausura (`snake`, `dir`, `queue`, `food`, `eaten`, `score`, `status`, `acc`, `lastTime`); `keydown` en `window`, `blur` en `window`, `visibilitychange` en `document` (todos a `destroy`) |
| Canvas              | 800×600 interno; rejilla de 40×30 celdas de 20 px (1 200 celdas)                                                                                                                                        |
| HUD y overlays      | Puntuación y Nivel a React; Vidas oculto. `PAUSA`, `GAME OVER` y `¡TABLERO COMPLETO!` se dibujan en canvas                                                                                              |
| Puntuación          | `10 × nivel` por núcleo, con `nivel = floor(núcleos / 5) + 1` evaluado antes de contar el núcleo; máximo plausible ≈ 1 441 200 (1 197 núcleos)                                                          |
| Estados             | `playing`, `paused`, `gameover` (cabeza en el cuerpo, o tablero lleno); sin vidas ni `dead`                                                                                                             |
| Controles           | `←` `↑` `→` `↓` para girar; `P` / `Escape` pausan; `Espacio` reinicia en `gameover`                                                                                                                     |
| Assets              | Ninguno: todo se dibuja con primitivas de canvas                                                                                                                                                        |
| Discrepancias       | El `long` del catálogo dice que **cada bocado** la hace más veloz; con las reglas de este spec la velocidad sube **cada 5 núcleos** (al subir de nivel). El texto no se cambia (ver Decisions)          |

## Scope

**In:**

- Motor en `lib/games/serpentina/` (`constants.ts`, `utils.ts`, `entities.ts`, `game.ts`) con `createSerpentinaGame(canvas, callbacks)` → `{ pause, resume, restart, destroy }`.
- Reglas: rejilla 40×30 de celdas de 20 px; serpiente inicial de 3 celdas en el centro mirando a la derecha; un núcleo en una celda libre al azar; al comerlo la serpiente crece 1 celda y reaparece otro núcleo; los bordes se **atraviesan** (la serpiente sale por el lado opuesto); GAME OVER al entrar la cabeza en una celda de su propio cuerpo; si la serpiente llena las 1 200 celdas el motor emite `gameover` con el overlay `¡TABLERO COMPLETO!`.
- Puntuación y progresión: `10 × nivel` por núcleo; el nivel sube en 1 cada 5 núcleos; intervalo de paso `max(60, 150 − (nivel − 1) × 10)` ms.
- Control por teclado con flechas; se ignora el giro de 180° y se encolan hasta 2 giros por paso para que los toques rápidos no se pierdan.
- Canvas 800×600 (mismo tamaño que Asteroids y Arkanoid): sin cambios de dimensiones en `GameScreen`; solo se añade la entrada de Serpentina en `GAMES_CONFIG` con `showLives: false` y `showNext: false`.
- HUD React: Jugador, Puntuación y Nivel (`01`, `02`, …). Vidas oculto. El motor emite `lives: 0`.
- Pausa (`P` / `Escape`, `blur`, `visibilitychange`) con overlay `PAUSA`, `preventDefault` sobre flechas y `Espacio`, reinicio con `Espacio` en `gameover` (solo en la pulsación inicial, `!e.repeat`).
- Registro en `GAMES_CONFIG` (`components/game/game-screen.tsx`) y en `PLAYABLE_GAME_IDS` (`lib/games.ts`).
- Migración `supabase/migrations/20261101120000_delete_serpentina_seeds.sql`: borra las 10 filas `is_seed` de `serpentina`; la fila de `games` no cambia.
- Guardado automático de la puntuación en GAME OVER con el `saveScore` existente (sin código de leaderboard nuevo).
- Estilo visual **inspirado en los platformers de Nintendo (New Super Mario Bros.)**, dibujado con arte propio en canvas: cielo celeste, nubes, colinas pastel, serpiente de dibujo animado con contorno y brillo, monedas doradas como núcleos y overlays con texto de contorno grueso. Detalle en la sección _Dirección visual_. Se diseña con `/frontend-design`, como exige `CLAUDE.md`.
- Actualizar `CLAUDE.md` (Architecture notes): recuento de filas `is_seed` y entrada de `serpentina` en `GAMES_CONFIG`.

**Out of scope (para specs futuros):**

- Sonido y música.
- Controles táctiles, gamepad o teclas `WASD`.
- Obstáculos, bonus, núcleos especiales, modos de juego o selector de dificultad.
- Cambiar el texto `long` del catálogo o la portada `cover-snake`.
- Reescalar o conservar las semillas de `serpentina`.
- Auth, anti-trampas y rate limit (heredado del SPEC 06).
- Tests automatizados: el repo no tiene test runner.
- Modificar `references/`, `lib/games/asteroids/`, `lib/games/tetris/` o `lib/games/arkanoid/`.
- Otros juegos del catálogo (`gloton`, `invasores`, `ranaria`, `duelo-pixel`): un spec por juego.
- Usar personajes, sprites, música, tipografía o cualquier asset de Nintendo (Mario, Yoshi, Goomba, Koopa, monedas o bloques copiados): solo se imita el estilo general, con dibujos propios.
- Adaptar el marco CRT, el HUD de React o la barra inferior al nuevo estilo: solo cambia lo que se dibuja dentro del canvas.
- Cambiar la portada `cover-snake` o los textos del catálogo para que coincidan con el nuevo estilo.

## Data model

Sin tablas ni columnas nuevas. Cambia el contenido de `scores` (se borran 10 filas `is_seed`) y se activa un motor para una fila de `games` que ya existe. Sin cambios en `lib/games/types.ts`: `GameStatus`, `GameHud` y `GameCallbacks` bastan (`dead` no se usa; el tablero completo se emite como `gameover`).

Configuración en `GameScreen` (entrada nueva, sin tocar las existentes):

```ts
// components/game/game-screen.tsx
// serpentina: { create: createSerpentinaGame, width: 800, height: 600, showLives: false, showNext: false }
```

Estructura del motor:

| Archivo                             | Contenido                                                                                                                                                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/games/serpentina/constants.ts` | `W = 800`, `H = 600`, `CELL = 20`, `COLS = 40`, `ROWS = 30`, `INITIAL_LENGTH = 3`, `FOOD_PER_LEVEL = 5`, `POINTS_PER_FOOD = 10`, `BASE_STEP_MS = 150`, `STEP_DECREMENT_MS = 10`, `MIN_STEP_MS = 60`, `MAX_QUEUED_TURNS = 2` |
| `lib/games/serpentina/utils.ts`     | `stepInterval(level)`, `levelFor(eaten)`, `wrap(cell)`, `randomFreeCell(snake, random)`, `isOpposite(a, b)`                                                                                                                 |
| `lib/games/serpentina/entities.ts`  | Tipos `Cell`, `Direction`; `drawGrid(ctx)`, `drawSnake(ctx, snake)`, `drawFood(ctx, cell)` (reciben todo por parámetro, sin globals)                                                                                        |
| `lib/games/serpentina/game.ts`      | Estado en clausura, `reset`, `step`, `update(dt)`, `draw()`, loop, input, pausa, overlays, `onHudChange`, `destroy`                                                                                                         |

Fragmento ilustrativo de los tipos:

```ts
// lib/games/serpentina/entities.ts
export type Cell = { x: number; y: number }; // columna 0..COLS-1, fila 0..ROWS-1
export type Direction = "up" | "down" | "left" | "right";
// snake: Cell[] con la cabeza en el índice 0
```

Convenciones:

- Coordenadas de celda con origen arriba a la izquierda; píxel = celda × `CELL`. El juego ocupa el canvas completo (800×600).
- `update(dt)` acumula `dt` (limitado a 50 ms) en `acc`; cuando `acc ≥ stepInterval(level)` se ejecuta **un** paso y se resta el intervalo. Como el intervalo mínimo (60 ms) supera al límite de `dt` (50 ms), nunca hay más de un paso por frame.
- Un paso: tomar el siguiente giro de la cola (si no es opuesto a la dirección actual), calcular la nueva cabeza con `wrap`, comprobar colisión con el cuerpo, insertar la cabeza y, si cae sobre el núcleo, sumar puntos y crecer; si no, quitar la cola. La celda de la cola actual **no** cuenta como colisión cuando no se come (la cola se libera en ese mismo paso).
- Al comer: `points = POINTS_PER_FOOD × levelFor(eaten)` con `eaten` antes de incrementar; después `eaten += 1`. Así el 5.º núcleo todavía vale `10 × nivel` del nivel que se cierra.
- Nivel: `levelFor(eaten) = floor(eaten / FOOD_PER_LEVEL) + 1`.
- El nuevo núcleo se elige entre las celdas libres con `Math.random` (nunca sobre la serpiente). Si no quedan celdas libres, el motor pasa a `gameover` con la bandera interna `won = true` para elegir el texto del overlay.
- El motor emite `score`, `lives: 0`, `level` y `status`. `onHudChange` solo se invoca si cambia algún campo.
- Al reanudar, `lastTime` se reinicia (primer `dt` = 0) y `acc` se conserva.
- La pausa solo actúa en estado `playing`. El estado `paused` vuelve a `playing` al reanudar.
- Entradas: `ArrowUp/Down/Left/Right` encolan un giro (máx. `MAX_QUEUED_TURNS`), `KeyP` / `Escape` alternan pausa, `Space` reinicia en `gameover` (solo con `!e.repeat`). Los giros se ignoran en pausa y en `gameover`.
- `restart()` rearma `score = 0`, `eaten = 0`, nivel 1, serpiente inicial en el centro mirando a la derecha, cola de giros vacía, `acc = 0` y un núcleo nuevo.

## Dirección visual

No hay referencia visual en `references/`: el estilo lo marca la imagen que aportó el usuario (arte de New Super Mario Bros.: colores saturados, cielo azul, nubes redondas, colinas pastel, suelo con hierba, monedas y bloques). Se imita el **estilo general**, no ningún personaje ni sprite. Todo se dibuja con primitivas de canvas (sin imágenes ni `public/games/serpentina/`).

Contraste con los otros juegos: Asteroids, Tetris y Arkanoid son neón sobre fondo oscuro dentro del marco CRT; Serpentina será brillante y colorida **dentro del mismo marco**. El marco, el HUD de React y la barra inferior no cambian.

- **Fondo (capa estática):** degradado vertical de cielo (celeste claro arriba, celeste más saturado abajo), 4–5 nubes blancas de bordes redondeados con una sombra azul suave, 2 filas de colinas pastel (verde menta, rosa, amarillo) y una franja de suelo con hierba verde y tierra naranja con patrón de ondas en la parte inferior. Se dibuja una sola vez en un canvas fuera de pantalla y se copia en cada frame con `drawImage`.
- **Legibilidad de la rejilla:** damero muy sutil (blanco con ~8 % de opacidad) encima del fondo, para que se perciba la celda de 20 px sin competir con la serpiente. Las colinas y el suelo son solo decoración: la serpiente se mueve por encima y por toda la rejilla.
- **Sin muros dibujados:** como los bordes se atraviesan, no hay marco de ladrillos ni tuberías en el perímetro, para no sugerir paredes.
- **Serpiente:** segmentos redondeados de color naranja-amarillo vivo con contorno oscuro de 2 px y un brillo blanco en la parte superior de cada segmento, para dar aspecto de dibujo animado. Cada segmento ocupa 18 px dentro de la celda de 20 px (hueco de 2 px); un tono algo más claro y otro más oscuro alternados dan relieve. No imita la piel ni los lunares de ningún personaje existente.
- **Cabeza:** algo más grande que el cuerpo (celda completa), con dos ojos blancos grandes con pupila negra que miran en la dirección del movimiento, y mejillas rosadas.
- **Núcleo = moneda:** moneda dorada con contorno ocre y brillo; gira (su ancho oscila con un seno según el tiempo del motor) de forma continua; una moneda genérica, no el sprite de ningún juego.
- **Al comer:** destello de 3–4 estrellas amarillas durante ~300 ms y un texto flotante `+10`, `+20`… (la puntuación real de ese núcleo) que sube y se desvanece en ~500 ms. Son solo adornos: no cambian reglas ni el `status`.
- **Nivel:** el texto de nivel y la puntuación siguen en el HUD de React; el canvas no los dibuja.
- **Overlays (`PAUSA`, `GAME OVER`, `¡TABLERO COMPLETO!`):** velo azul oscuro semitransparente sobre el tablero y un panel redondeado crema con contorno marrón; texto en sans-serif redondeada del sistema (sin cargar fuentes nuevas), negrita, blanco con contorno marrón grueso y sombra, al estilo de los carteles de estos juegos. El tamaño de fuente se ajusta para que `¡TABLERO COMPLETO!` quepa en 800 px.
- **Pausa:** las nubes (si se animan) y la rotación de la moneda se detienen con el motor.
- **Rendimiento:** la capa de fondo se cachea y por frame solo se dibujan damero, serpiente, moneda y adornos.

## Implementation plan

Antes de empezar: leer en `node_modules/next/dist/docs/` lo relativo a Client Components y `useEffect` con `cacheComponents`, y a `revalidateTag` / `updateTag` para el catálogo cacheado (`cacheTag("games")`). Invocar `/frontend-design` antes del paso 2.

1. **Constantes y utilidades.** Crear `lib/games/serpentina/constants.ts` y `utils.ts` con los valores de la sección Data model, `stepInterval`, `levelFor`, `wrap`, `isOpposite` y `randomFreeCell` (recibe la función de azar por parámetro). Verificar: `npx tsc --noEmit` pasa y una comprobación temporal fuera del repo confirma `stepInterval(1) = 150`, `stepInterval(10) = 60`, `stepInterval(30) = 60`, `levelFor(4) = 1`, `levelFor(5) = 2`.
2. **Entidades y dibujo.** Crear `lib/games/serpentina/entities.ts` con los tipos y las funciones de dibujo (`drawBackground` sobre un canvas fuera de pantalla, `drawCheckerboard`, `drawSnake`, `drawCoin`, `drawEatEffect`), siguiendo la sección _Dirección visual_ y diseñadas con `/frontend-design`. Si el archivo supera ~50 líneas por función, dividir en `lib/games/serpentina/draw.ts`. Verificar: `npx tsc --noEmit` y `npm run lint` pasan.
3. **Motor.** Crear `lib/games/serpentina/game.ts` con `createSerpentinaGame`: estado en clausura, `reset`, `step` (giro, `wrap`, colisión, crecer, puntuar, nivel, tablero lleno), `update(dt)` con acumulador, `draw()`, loop con `requestAnimationFrame`, teclado en `window`, `onHudChange` y `destroy`. Verificar: `npx tsc --noEmit` y `npm run lint` pasan.
4. **Pausa, foco, overlays y scroll.** Añadir `pause` / `resume`, `P` / `Escape`, overlay `PAUSA`, overlays `GAME OVER` y `¡TABLERO COMPLETO!` (con puntaje y «ESPACIO PARA REINICIAR», tamaño de fuente que quepa en 800 px), pausa con `blur` y `visibilitychange`, `preventDefault` sobre flechas y `Espacio`, y reinicio con `Espacio` en `gameover`. Verificar: `npx tsc --noEmit` y `npm run lint` pasan.
5. **Catálogo.** Crear `supabase/migrations/20261101120000_delete_serpentina_seeds.sql` (`delete from public.scores where game_id = 'serpentina' and is_seed;`) y aplicarla con `apply_migration`; no hay cambio de esquema, así que no se regeneran los tipos. Verificar con `execute_sql`: `select count(*) from scores where is_seed` = 50, `select count(*) from scores where game_id = 'serpentina'` = 0, `select count(*) from games` = 8, y `get_advisors` (security) sin avisos nuevos.
6. **Registro.** Añadir `serpentina` a `GAMES_CONFIG` y a `PLAYABLE_GAME_IDS`. Verificar: `/juegos/serpentina/jugar` muestra el juego, `/juegos/gloton/jugar` sigue mostrando «JUEGO PRÓXIMAMENTE» y `/juegos/asteroids/jugar`, `/juegos/tetris/jugar` y `/juegos/arkanoid/jugar` siguen igual.
7. **Guardado y ranking.** Comprobar de punta a punta GAME OVER → `saveScore` → `/juegos/serpentina` y `/salon`, incluidos los estados con el ranking vacío (`game_stats` sin fila para `serpentina` antes de la primera partida). Verificar con `execute_sql` y Playwright.
8. **Documentar.** Actualizar `CLAUDE.md`, Architecture notes: filas `is_seed` (50, ya no 60, y los juegos que cubren: `gloton`, `invasores`, `ranaria`, `duelo-pixel` y `tetris`), `serpentina` en el punto de `GAMES_CONFIG` (800×600, `showLives: false`) y la nota de juegos sin vidas. Verificar: `git diff` de `CLAUDE.md` muestra solo ese cambio.

## Acceptance criteria

**Build**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] `lib/games/serpentina/` no importa `react` ni `next/*`.
- [ ] `git grep -nE "^let |^var " -- lib/games` no devuelve resultados.
- [ ] No se modifica ningún archivo de `references/`, `lib/games/asteroids/`, `lib/games/tetris/` ni `lib/games/arkanoid/`.
- [ ] No se crea `public/games/serpentina/` (el juego no usa assets).

**Integración**

- [ ] `/juegos/serpentina/jugar` muestra el canvas 800×600 con una serpiente de 3 celdas y un núcleo dentro del marco CRT.
- [ ] `/juegos/gloton/jugar` (y los demás no jugables) siguen mostrando «JUEGO PRÓXIMAMENTE»; `/juegos/inexistente/jugar` da 404.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar` y `/juegos/arkanoid/jugar` se ven y se comportan igual que antes.
- [ ] SALIR navega a `/juegos/serpentina`.
- [ ] La consola no muestra errores ni avisos de hidratación en `/juegos/serpentina/jugar`.
- [ ] `/biblioteca` y la sección de juegos del home siguen mostrando 8 y 6 juegos, sin duplicados.

**Jugabilidad (manual)**

- [ ] La serpiente arranca con 3 celdas en el centro del tablero moviéndose a la derecha, sin esperar una tecla.
- [ ] Las flechas giran la serpiente; pulsar la dirección opuesta a la actual no hace nada.
- [ ] Dos giros pulsados dentro del mismo paso se aplican en pasos consecutivos (se encolan, máx. 2); un tercero se descarta.
- [ ] Al salir por un borde la serpiente reaparece por el lado opuesto en la misma fila o columna y la partida sigue en `playing`.
- [ ] El núcleo nunca aparece sobre una celda ocupada por la serpiente.
- [ ] Comer un núcleo alarga la serpiente exactamente 1 celda y suma `10 × nivel` (10 en el nivel 1).
- [ ] Al comer el 5.º núcleo el nivel pasa de 1 a 2; el propio 5.º núcleo suma 10 y el 6.º suma 20.
- [ ] El intervalo de paso es 150 ms en el nivel 1, baja 10 ms por nivel y se queda en 60 ms desde el nivel 10.
- [ ] Meter la cabeza en el propio cuerpo termina la partida: el canvas muestra `GAME OVER` con el puntaje y «ESPACIO PARA REINICIAR».
- [ ] Moverse hacia la celda que la cola libera en ese mismo paso no termina la partida.
- [ ] Al llenar las 1 200 celdas el canvas muestra `¡TABLERO COMPLETO!` con el puntaje y «ESPACIO PARA REINICIAR», el HUD pasa a `gameover` y la puntuación se guarda (comprobable con una constante temporal de tablero reducido que se retira antes de cerrar).
- [ ] `Espacio` en `gameover` reinicia con puntuación 0, nivel 1, serpiente de 3 celdas y un núcleo nuevo.

**HUD React**

- [ ] Puntuación y Nivel coinciden con el estado del juego; el nivel se muestra con dos dígitos (`01`, `02`, …).
- [ ] El HUD no muestra Vidas.
- [ ] Jugador muestra el nombre de la sesión mock o `INVITADO`.
- [ ] `onHudChange` solo se invoca cuando cambia un campo (comprobable con un `console.count` temporal que se retira antes de cerrar).

**Pausa, foco y teclado**

- [ ] `P` y `Escape` pausan y reanudan; en pausa la serpiente no avanza y el canvas muestra `PAUSA`.
- [ ] Tras reanudar, la serpiente no da un salto de varias celdas: el primer `dt` es 0.
- [ ] Cambiar de pestaña o quitar el foco a la ventana pausa el juego; volver no lo reanuda solo.
- [ ] Con el juego montado, flechas y `Espacio` no desplazan la página.
- [ ] Al salir de la ruta con SALIR o con el botón atrás ya no responde el teclado, y volver a entrar inicia una partida nueva; el doble efecto de React 19 no duplica la velocidad de la serpiente ni los giros.

**Guardado y leaderboard**

- [ ] Con sesión mock, un GAME OVER con puntuación mayor que 0 inserta exactamente una fila en `scores` con `game_id = 'serpentina'`, el nombre de la sesión y esa puntuación.
- [ ] La barra del marco muestra `GUARDANDO` y después `GUARDADO #N`, donde `N` coincide con el rango en `/salon`.
- [ ] Reiniciar con `Espacio` y volver a perder inserta una segunda fila; pausar, reanudar o redibujar no inserta filas extra.
- [ ] Una puntuación 0 no llama a `saveScore`; sin sesión aparece «INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN» con enlace a `/auth` y no se inserta nada.
- [ ] Si el guardado falla se muestra `ERROR` con `REINTENTAR` y el juego sigue operativo.
- [ ] La fila guardada aparece en `/juegos/serpentina` y en `/salon` sin reiniciar el servidor; la primera partida real ocupa el puesto #1.
- [ ] Antes de jugar, `/juegos/serpentina` y `/salon` se renderizan sin errores con el ranking de Serpentina vacío, y la tarjeta del juego muestra `best` 0 y `plays` 0.
- [ ] La puntuación máxima plausible (≈ 1 441 200) es menor que `SCORE_LIMITS.maxScore` (9 999 999).

**Base de datos**

- [ ] `select count(*) from games` devuelve 8 y la fila `serpentina` conserva `cover-snake`, color `green`, categoría `ARCADE` y `sort_order` 3.
- [ ] `select count(*) from scores where game_id = 'serpentina'` devuelve 0 antes de jugar y `select count(*) from scores where is_seed` devuelve 50.
- [ ] Existe `supabase/migrations/20261101120000_delete_serpentina_seeds.sql` y `list_migrations` la muestra aplicada.
- [ ] `get_advisors` (security) no reporta avisos nuevos.

**Visual (manual)**

- [ ] A 1440×900 y a 1366×650 el canvas se ve completo (pantalla y barra inferior del marco) sin scroll vertical, manteniendo 4:3.
- [ ] A 390×844 el canvas no desborda horizontalmente y el juego se ve completo (solo teclado).
- [ ] El fondo muestra cielo, nubes, colinas pastel y franja de suelo con hierba; no hay muros ni marco dibujado en el perímetro.
- [ ] Cabeza, cuerpo y moneda se distinguen entre sí y del fondo, tanto sobre el cielo como sobre las colinas y el suelo; el damero no compite con la serpiente.
- [ ] Los ojos de la cabeza miran en la dirección del último paso.
- [ ] La moneda gira de forma continua y se detiene en pausa.
- [ ] Comer un núcleo muestra el destello y un texto flotante con los puntos reales de ese núcleo (`+10` en el nivel 1, `+20` en el nivel 2), que desaparece solo.
- [ ] El estilo no usa ningún asset de Nintendo: `git status` no lista imágenes ni fuentes nuevas.
- [ ] El marco CRT, el HUD de React y la barra inferior se ven igual que en los otros juegos.
- [ ] Los overlays `PAUSA`, `GAME OVER` y `¡TABLERO COMPLETO!` son legibles sobre la serpiente y caben dentro de los 800 px del canvas.

**Sin efectos colaterales**

- [ ] Ninguna clave secreta ni `service_role` en el repo.
- [ ] `git status` lista solo `lib/games/serpentina/`, `lib/games.ts`, `components/game/`, `supabase/migrations/`, `CLAUDE.md` y este spec.

## Decisions

- **Sí:** juego desde cero con reglas cerradas con el usuario. No hay referencia en `references/`; el spec, y no un código previo, es la fuente de verdad de reglas y números.
- **Sí:** estilo visual inspirado en Mario (New Super Mario Bros.), con arte propio dibujado en canvas. Decisión del usuario, que aportó la imagen de referencia; da a Serpentina una identidad propia y alegre, sin necesitar assets.
- **No:** reutilizar personajes o sprites de Nintendo. Son propiedad intelectual de terceros; solo se toma el estilo general (colores saturados, contornos, brillos, monedas, nubes). La serpiente y la moneda son dibujos originales.
- **Sí:** cambiar solo lo que se dibuja dentro del canvas; el marco CRT neón, el HUD y la barra inferior se conservan. Mantiene la coherencia de la plataforma y evita tocar `GameScreen` y el CSS global. La diferencia de estilo con los otros tres juegos es intencionada.
- **Sí:** núcleo dibujado como moneda dorada. Sustituye al «núcleo magenta» del texto del catálogo; el copy (`long`, «serpiente de luz») y la portada `cover-snake` quedan desfasados con el nuevo estilo y se tratan en otro spec.
- **Sí:** fondo cacheado en un canvas fuera de pantalla y adornos de comer (destello y `+N`) solo cosméticos. Mantienen el coste por frame bajo y no tocan reglas ni `status`.
- **Sí:** canvas 800×600 con rejilla de 40×30 y celda de 20 px. Decisión del usuario; no cambia `GameScreen` ni el marco CRT 4:3, y 1 200 celdas dan partidas largas.
- **No:** rejillas cuadradas (600×600 o 400×400). Exigían un marco distinto al 4:3 de Asteroids y Arkanoid y más trabajo en CSS para el mismo juego.
- **Sí:** los bordes se atraviesan (`wrap`). Decisión del usuario; solo mata la propia cola, lo que alarga las partidas y hace alcanzable un nivel alto.
- **No:** muerte contra las paredes. Era lo más fiel al Snake clásico, pero el usuario eligió el modo más permisivo.
- **Sí:** `10 × nivel` por núcleo y nivel +1 cada 5 núcleos, con intervalo `max(60, 150 − (nivel − 1) × 10)` ms. Decisión del usuario; da un Nivel real que mostrar en el HUD y una curva de dificultad acotada (tope en el nivel 10).
- **No:** 10 puntos fijos con velocidad por núcleo. Dejaba el Nivel del HUD sin significado.
- **Sí:** el 5.º núcleo se puntúa con el nivel previo al incremento. Regla única y comprobable: `points = 10 × levelFor(eaten)` antes de `eaten += 1`.
- **Sí:** sin vidas. HUD con Vidas oculto (`showLives: false`) y `lives: 0` en el motor, como Tetris; una colisión termina la partida.
- **Sí:** borrar las 10 semillas `is_seed` de `serpentina`. Decisión del usuario. Matiz: la premisa de la pregunta («máximo ≈ 11 990») era anterior a la fórmula `10 × nivel`; con ella el máximo plausible es ≈ 1 441 200 y las semillas (38 387–213 991) serían alcanzables en teoría, pero solo con más de 90 niveles (≈ 460 núcleos) y una serpiente muy larga. Se mantiene la decisión del usuario: el ranking arranca vacío y la primera partida real es el #1.
- **No:** conservar las semillas. Dejaban un TOP 10 prácticamente inalcanzable en partidas normales y mezcladas con datos inventados.
- **Sí:** teclado solo con flechas. Es el control que ya usan Asteroids, Tetris y Arkanoid; `WASD` queda fuera de alcance.
- **Sí:** cola de hasta 2 giros y rechazo del giro de 180°. Evita que dos pulsaciones rápidas dentro de un mismo paso hagan que la serpiente se muerda a sí misma por error de control.
- **Sí:** tablero lleno como `gameover` con overlay propio, el mismo criterio que la victoria de Arkanoid (SPEC 08): no se amplía `GameStatus` y el guardado de `GameScreen` no se toca.
- **Sí:** no tocar el texto `long` del catálogo. Dice «cada bocado la alarga y la hace más veloz»; la velocidad sube por nivel, no por bocado. Es una discrepancia menor de copy y cambiarlo es otro spec (como en SPEC 05 con los OVNIs).
- **Sí:** `Math.random` solo dentro del motor para colocar el núcleo, con la función de azar pasada por parámetro a `randomFreeCell`. Cumple el contrato del motor y permite una comprobación determinista temporal.
- **Sí:** limitar `dt` a 50 ms. Cumple el contrato del motor y, al ser menor que el intervalo mínimo de 60 ms, garantiza un solo paso por frame.
- **Sí:** reiniciar con `Espacio` en `gameover`, como exige el contrato del motor.
- **Sí:** validación manual más consultas SQL y `git grep`. Sin test runner en el repo.

## Risks

| Riesgo                                                                                                           | Mitigación                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| React 19 ejecuta `useEffect` dos veces en desarrollo y puede duplicar loop o listeners                           | `destroy()` cancela `requestAnimationFrame` y retira cada listener con la misma referencia; criterio sobre el doble efecto                                                     |
| `preventDefault` global rompe la navegación por teclado                                                          | Listeners solo mientras `GameScreen` está montado                                                                                                                              |
| Giros perdidos o muerte por giro de 180° con pulsaciones rápidas                                                 | Cola de 2 giros comparada siempre con la dirección vigente del último paso; criterios de jugabilidad sobre la cola y el rechazo del giro opuesto                               |
| Colisión falsa con la celda de la cola, que se libera en ese mismo paso                                          | `step` comprueba el cuerpo sin la cola cuando no se come; criterio de aceptación específico                                                                                    |
| `randomFreeCell` falla o se cuelga con la serpiente casi llenando el tablero                                     | Se elige entre la lista de celdas libres (no por reintentos); lista vacía → tablero completo; criterio comprobable con un tablero reducido temporal                            |
| Ranking vacío: `game_stats` no tiene fila para `serpentina` y alguna vista o consulta asume al menos un registro | Criterio de aceptación sobre `/juegos/serpentina`, biblioteca y `/salon` sin semillas; el paso 7 lo verifica antes de cerrar                                                   |
| El borrado de semillas es irreversible                                                                           | Acotado por `game_id = 'serpentina' and is_seed`; verificación del recuento (50) tras aplicarla. Las semillas siguen en la migración `create_scores` si se quisieran recuperar |
| El catálogo cacheado (`use cache`, `cacheTag("games")`) no cambia, pero `best`/`plays` de `game_stats` sí        | `getGamesWithStats` es dinámica y no se cachea; `saveScore` ya hace `revalidatePath` de `/salon` y `/juegos/{id}`                                                              |
| Un overlay con texto largo (`¡TABLERO COMPLETO!`) a tamaño grande mide más de 800 px y se corta                  | El tamaño de fuente se ajusta para que quepa; criterio visual                                                                                                                  |
| Una puntuación mayor que `SCORE_LIMITS.maxScore` haría fallar el guardado                                        | Máximo plausible ≈ 1 441 200; sin riesgo                                                                                                                                       |

## What is **not** in this spec

- Sonido y música.
- Controles táctiles, gamepad o teclas `WASD`.
- Obstáculos, bonus, núcleos especiales, modos de juego o dificultad seleccionable.
- Cambiar el texto del catálogo o la portada `cover-snake`.
- Reescalar o conservar las semillas de `serpentina`.
- Auth, anti-trampas y rate limit.
- Nuevos estados en `GameStatus`.
- Tests automatizados.
- Cambios a `references/`.
- Los otros juegos no jugables del catálogo.

Cada uno de estos puntos, si se aborda, va en su propio spec.
