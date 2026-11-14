# SPEC 10 — Controles táctiles para jugar en móvil

> **Status:** implemented
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 08, SPEC 09 (y el selector de skins de `GameScreen`, ya en el árbol de trabajo)
> **Date:** 2026-11-04
> **Objective:** Añadir a `/juegos/[id]/jugar` un mando táctil (cruceta + A/B + PAUSA) que solo aparece en dispositivos táctiles y emite `KeyboardEvent` sintéticos, de modo que Asteroids, Tetris, Arkanoid y Serpentina se puedan jugar de principio a fin con el dedo sin tocar ningún motor.

---

## Por qué existe este spec

Hoy los cuatro motores solo escuchan teclado en `window` (`keydown`/`keyup` con `e.code`) y Arkanoid además `mousemove` sobre el canvas. En un móvil no hay forma de girar, disparar, pausar ni reiniciar (`Espacio` en `gameover`), así que ningún juego es jugable.

La solución elegida respeta el contrato del motor (`lib/games/*` sin React ni cambios de API): una capa de React fuera del canvas traduce toques en eventos de teclado sintéticos. Los motores no saben que existe.

Análisis de los motores (entradas que el mando debe cubrir):

| Juego      | Teclas que usa                                                                                      | Tipo de entrada                                            |
| ---------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Asteroids  | `ArrowLeft`/`ArrowRight` (girar), `ArrowUp` (empuje), `Space` (disparo)                             | Estado mantenido (`keydown`/`keyup`), varias a la vez      |
| Tetris     | `ArrowLeft`/`ArrowRight`, `ArrowDown` (caída suave), `ArrowUp`/`KeyX` (rotar), `Space` (caída dura) | Acción en cada `keydown`; depende del autorepetido del SO  |
| Arkanoid   | `ArrowLeft`/`ArrowRight` (mantenidas), `mousemove` sobre el canvas                                  | Estado mantenido                                           |
| Serpentina | `ArrowUp/Down/Left/Right` (encolan giros)                                                           | Acción en cada `keydown`; repetir duplicaría giros en cola |
| Todos      | `KeyP`/`Escape` (pausa), `Space` en `gameover` (reinicio, solo `!e.repeat`)                         | `keydown`                                                  |

## Scope

**In:**

- Componente `components/game/touch-controls.tsx` (Client Component) con un **mando único para todos los juegos**: cruceta de 4 direcciones, botones **A** y **B**, botón **PAUSA** (alterna `PAUSA`/`SEGUIR` según el estado) y botón **REINICIAR** visible solo en `gameover`.
- Hook `components/game/use-touch-keys.ts` que despacha `KeyboardEvent` sintéticos (`keydown`/`keyup`, `bubbles: true`, `cancelable: true`) en `window` y gestiona las teclas mantenidas.
- Correspondencia fija de controles a teclas: ↑ `ArrowUp`, ↓ `ArrowDown`, ← `ArrowLeft`, → `ArrowRight`, A `Space`, B `KeyX`, PAUSA `KeyP`, REINICIAR `Space`.
- Configuración por juego en `GAMES_CONFIG` (`components/game/game-screen.tsx`): `touchKeys` (qué controles tienen función en ese juego; los demás se muestran atenuados y no responden) y `touchRepeat` (autorepetido de la cruceta).
- Soporte multitoque: varios botones pulsados a la vez (p. ej. empuje + giro + disparo en Asteroids) con `PointerEvent` y `setPointerCapture`.
- Autorepetido de la cruceta solo con `touchRepeat: true` (Tetris): primer `keydown` con `repeat: false`, y tras 170 ms uno cada 50 ms con `repeat: true`.
- Visibilidad **solo en dispositivos táctiles** por CSS: `@media (hover: none) and (pointer: coarse)`. Sin JavaScript de detección, sin riesgo de hidratación. En escritorio no cambia nada.
- Pausa y reinicio táctiles (botones PAUSA y REINICIAR) para poder volver a jugar sin teclado.
- Rediseño del layout de `/juegos/[id]/jugar` a 390×844: nav, HUD, marco CRT y mando visibles a la vez sin scroll vertical de página, incluido Tetris (`crt--side`), y selector de skins usable.
- Bloqueo de gestos del navegador sobre el juego: `touch-action: none` en el mando y en el canvas, `touch-action: manipulation` en el contenedor del juego (sin zoom por doble toque), `user-select: none`, `-webkit-touch-callout: none`, `contextmenu` cancelado sobre el mando y `overscroll-behavior-y: contain` en `html` mientras `GameScreen` está montado (sin pull-to-refresh).
- Liberación segura de teclas mantenidas: `pointerup`, `pointercancel`, `lostpointercapture`, `blur` de la ventana, `visibilitychange` y desmontaje envían `keyup` de todo lo que siga pulsado.
- Diseñar el mando con `/frontend-design`, como exige `CLAUDE.md`.
- Actualizar `CLAUDE.md` (Architecture notes) con el mando táctil y `touchKeys`/`touchRepeat`.

**Out of scope (para specs futuros):**

- Modificar `lib/games/**` (motores, skins, `types.ts`) o `references/`.
- Gestos sobre el canvas (deslizar para girar, arrastrar la pala de Arkanoid). Arkanoid se juega con ← y →; el `mousemove` emulado por el navegador tras un toque queda como está.
- Mandos distintos por juego, mando configurable, reposicionable o con interruptor de mostrar/ocultar.
- Orientación horizontal optimizada (mandos a los lados del canvas). En apaisado el mando va debajo y la página puede hacer scroll; no debe romperse, pero no se optimiza.
- Variantes del mando por skin (`neon`/`classic`/`mario`): el mando tiene un solo aspecto.
- Vibración háptica, sonido, giroscopio.
- Detección de dispositivo por JavaScript o user agent; mostrar el mando en escritorio con pantalla táctil de puntero principal fino.
- Gamepad físico, teclado en pantalla, `WASD`.
- Cambiar reglas, velocidades o puntuaciones; auth, anti-trampas y rate limit.
- Tests automatizados: el repo no tiene test runner.
- Otras rutas (`/`, `/biblioteca`, `/salon`, `/acerca-de`, `/auth`) más allá de lo que ya funcione en móvil.

## Data model

Sin tablas, columnas ni migraciones. Sin persistencia (no se guarda nada en `localStorage`). Solo cambia la configuración en memoria de `GameScreen`.

```ts
// components/game/touch-controls.tsx
export type TouchKey = "up" | "down" | "left" | "right" | "a" | "b";

// components/game/game-screen.tsx — se añaden dos campos a GameConfig
// touchKeys: TouchKey[];   touchRepeat: boolean;
//
// asteroids:  touchKeys ["up", "left", "right", "a"],                   touchRepeat false
// tetris:     touchKeys ["up", "down", "left", "right", "a", "b"],      touchRepeat true
// arkanoid:   touchKeys ["left", "right", "a"],                         touchRepeat false
// serpentina: touchKeys ["up", "down", "left", "right"],                touchRepeat false
```

Correspondencia de controles a eventos:

| Control   | `code`       | `key`        | Notas                                                                      |
| --------- | ------------ | ------------ | -------------------------------------------------------------------------- |
| ↑         | `ArrowUp`    | `ArrowUp`    | Empuje (Asteroids), rotar (Tetris), girar (Serpentina)                     |
| ↓         | `ArrowDown`  | `ArrowDown`  | Caída suave (Tetris), girar (Serpentina)                                   |
| ←         | `ArrowLeft`  | `ArrowLeft`  |                                                                            |
| →         | `ArrowRight` | `ArrowRight` |                                                                            |
| A         | `Space`      | ` `          | Disparo (Asteroids), caída dura (Tetris), reinicio en `gameover`           |
| B         | `KeyX`       | `x`          | Rotar (Tetris); sin función en los demás juegos                            |
| PAUSA     | `KeyP`       | `p`          | Un solo `keydown` + `keyup` por toque                                      |
| REINICIAR | `Space`      | ` `          | Solo visible con `status === "gameover"`; un `keydown` con `repeat: false` |

Interfaz del hook (ilustrativa):

```ts
// components/game/use-touch-keys.ts
// press(code, { repeat }): keydown inmediato y, si repeat, temporizadores 170 ms / 50 ms
// release(code): keyup y limpia los temporizadores
// releaseAll(): keyup de todas las teclas pulsadas; se llama en blur, visibilitychange y cleanup
```

Convenciones:

- Cada botón guarda el `pointerId` que lo pulsa; un segundo dedo sobre el mismo botón se ignora y cada botón se libera solo con su propio `pointerId`.
- Los eventos sintéticos se despachan en `window`, que es donde escuchan los motores; el `preventDefault` de los motores sobre flechas y `Space` no afecta al mando.
- `GameScreen` pasa al mando `hud.status`, `touchKeys` y `touchRepeat`. El mando no importa nada de `lib/games/`.
- Tamaño mínimo de objetivo táctil: 48×48 px por botón.
- Por defecto (`display: none`) el mando no existe en el layout; solo se muestra dentro de la media query táctil.

## Implementation plan

Antes de empezar: leer en `node_modules/next/dist/docs/` lo relativo a Client Components, `useEffect` con `cacheComponents` y a la metadata `viewport`. Invocar `/frontend-design` antes del paso 3.

1. **Configuración.** Añadir `touchKeys` y `touchRepeat` al tipo `GameConfig` y a las cuatro entradas de `GAMES_CONFIG` con los valores del Data model. Sin cambio visible. Verificar: `npx tsc --noEmit` y `npm run lint` pasan; los cuatro juegos se ven y juegan igual en escritorio.
2. **Hook de teclas.** Crear `components/game/use-touch-keys.ts` con `press`, `release` y `releaseAll`, el autorepetido (170 ms / 50 ms) y la limpieza en el desmontaje. Verificar: `npx tsc --noEmit` y `npm run lint` pasan; `git grep -nE "^let |^var " -- components/game` no devuelve resultados.
3. **Mando.** Crear `components/game/touch-controls.tsx` (cruceta, A, B, PAUSA/SEGUIR, REINICIAR) con `PointerEvent`, `setPointerCapture`, atenuado de controles sin función y etiquetas accesibles en español (`aria-label`), y su CSS en `app/globals.css` (`.touch-pad*`, oculto por defecto y visible con `@media (hover: none) and (pointer: coarse)`). Montarlo en `GameScreen` debajo del marco `.crt`. Verificar: con emulación de dispositivo táctil el mando aparece; en escritorio no aparece y no ocupa espacio.
4. **Layout 390×844.** Ajustar `app/globals.css` y `GameScreen` para que en pantallas táctiles estrechas el HUD, el marco (incluido `crt--side` de Tetris) y el mando quepan sin scroll vertical (altura calculada con `dvh`, el marco se reduce manteniendo la proporción) y sin desborde horizontal; el selector de skins y SALIR siguen accesibles. Verificar: capturas a 390×844 de los cuatro juegos.
5. **Gestos del navegador.** Aplicar `touch-action`, `user-select`, `-webkit-touch-callout`, cancelar `contextmenu` en el mando y activar `overscroll-behavior-y: contain` en `html` con un efecto de `GameScreen` que lo retire en el cleanup. Verificar: doble toque sobre el mando no hace zoom, mantener pulsado no abre menú contextual y arrastrar hacia abajo no recarga.
6. **Liberación segura.** Conectar `releaseAll` a `blur`, `visibilitychange`, `pointercancel`, `lostpointercapture` y desmontaje; liberar también al llegar a `gameover`. Verificar: pulsar ← y cambiar de pestaña no deja la nave girando al volver.
7. **Documentar.** Actualizar `CLAUDE.md`, Architecture notes: mando táctil, `touchKeys`/`touchRepeat` en `GAMES_CONFIG` y su visibilidad por media query. Verificar: `git diff` de `CLAUDE.md` muestra solo ese cambio.

## Acceptance criteria

**Build**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] `components/game/touch-controls.tsx` y `use-touch-keys.ts` no importan nada de `lib/games/`.
- [ ] El diff de la rama de este spec no toca `lib/games/`, `references/` ni `supabase/`.
- [ ] `git grep -nE "^let |^var " -- lib/games components/game` no devuelve resultados.
- [ ] No se añade ninguna dependencia a `package.json`.

**Visibilidad y escritorio**

- [ ] En un dispositivo táctil (emulación con `isMobile` y `hasTouch`, o DevTools) el mando aparece en `/juegos/{asteroids,tetris,arkanoid,serpentina}/jugar`.
- [ ] En escritorio con ratón el mando no se ve (`display: none`) y el layout es idéntico al de antes en 1440×900 y 1366×650.
- [ ] El teclado sigue funcionando igual en los cuatro juegos.
- [ ] `/juegos/gloton/jugar` (no jugable) sigue mostrando «JUEGO PRÓXIMAMENTE» y no monta el mando; `/juegos/inexistente/jugar` da 404.
- [ ] La consola no muestra errores ni avisos de hidratación en las cuatro rutas de juego, en escritorio y en emulación táctil.

**Correspondencia de controles**

- [ ] Cada control despacha en `window` el `code` de la tabla del Data model, comprobable con un listener temporal que se retira antes de cerrar.
- [ ] Asteroids: ← y → giran la nave, ↑ la empuja y A dispara; ↓ y B aparecen atenuados y no despachan nada.
- [ ] Asteroids con multitoque: ↑ + → + A pulsados a la vez empujan, giran y disparan a la vez; soltar uno no libera los otros.
- [ ] Tetris: ← y → mueven la pieza, ↓ la baja, ↑ y B la rotan, A la deja caer de golpe.
- [ ] Tetris: mantener ← o → desplaza la pieza una vez, y tras 170 ms sigue a razón de una celda cada ~50 ms (eventos con `repeat: true`); soltar detiene el desplazamiento.
- [ ] Arkanoid: ← y → mueven la pala mientras se mantienen y la detienen al soltar; ↑, ↓ y B aparecen atenuados.
- [ ] Serpentina: las 4 direcciones giran la serpiente; mantener una dirección no encola giros repetidos (sin autorepetido); A y B aparecen atenuados.

**Pausa y reinicio**

- [ ] PAUSA pausa el juego (el canvas muestra `PAUSA`, el LED del marco pasa a pausa) y el botón pasa a mostrar `SEGUIR`; tocarlo reanuda.
- [ ] En `gameover` aparece el botón REINICIAR; tocarlo reinicia con puntuación 0, nivel 1 y estado `playing`, y desaparece.
- [ ] En `gameover`, A (`Space`) también reinicia y un toque largo no reinicia en cadena (`repeat: false`).
- [ ] Sin un juego en `gameover` el botón REINICIAR no ocupa espacio ni cambia el layout al aparecer (sin saltos del marco).

**Guardado y leaderboard**

- [ ] Una partida terminada con el mando, con sesión mock y puntuación > 0, inserta exactamente una fila en `scores` y la barra del marco muestra `GUARDANDO` y luego `GUARDADO #N`.
- [ ] Reiniciar con REINICIAR y volver a perder inserta una segunda fila; pausar y reanudar no inserta filas extra.

**Liberación segura de teclas**

- [ ] Pulsar ← y cambiar de pestaña (o bloquear la pantalla) envía `keyup`; al volver, la nave no sigue girando y la pala no sigue moviéndose.
- [ ] Un `pointercancel` (p. ej. el sistema interrumpe el toque) libera la tecla correspondiente.
- [ ] Salir con SALIR mientras se mantiene un botón no deja temporizadores de autorepetido activos (no llegan `keydown` a `window` tras desmontar).
- [ ] El doble efecto de React 19 en desarrollo no duplica eventos ni temporizadores.

**Layout móvil**

- [ ] A 390×844 el HUD, el marco CRT con el canvas completo, la barra inferior y el mando se ven a la vez sin scroll vertical de página, en los cuatro juegos (incluido Tetris con su panel lateral).
- [ ] A 390×844 y a 360×640 no hay desborde horizontal.
- [ ] El canvas conserva su proporción (4:3 en Asteroids, Arkanoid y Serpentina; 1:2 en Tetris) y no se deforma.
- [ ] Cada botón del mando mide al menos 48×48 px.
- [ ] El selector de skins (`NEÓN · CLÁSICO · MARIO BROS`) y SALIR siguen siendo pulsables a 390×844 y no quedan tapados por el mando.
- [ ] En apaisado (844×390) no hay desborde horizontal y el mando sigue funcionando (aunque haya scroll vertical).

**Gestos del navegador**

- [ ] Doble toque rápido sobre el mando o el canvas no hace zoom.
- [ ] Mantener pulsado un botón del mando no abre el menú contextual ni selecciona texto.
- [ ] Arrastrar hacia abajo sobre el mando o el canvas no recarga la página ni hace scroll.
- [ ] Al salir de `/juegos/{id}/jugar`, `html` ya no tiene `overscroll-behavior-y: contain` (el resto de rutas se comporta como antes).

**Accesibilidad**

- [ ] Cada botón tiene `aria-label` en español (p. ej. «Izquierda», «Acción A», «Pausa») y los atenuados llevan `aria-disabled="true"`.
- [ ] El mando se oculta con `display: none`, de modo que en escritorio no entra en el orden de tabulación.

**Sin efectos colaterales**

- [ ] Ninguna clave secreta ni `service_role` en el repo.
- [ ] `git status` lista solo `components/game/`, `app/globals.css`, `CLAUDE.md` y este spec.

## Decisions

- **Sí:** el mando emite `KeyboardEvent` sintéticos en `window`. Es la única vía que no toca los cuatro motores ni sus skins, conserva el contrato del motor (sin React ni Next) y reutiliza la lógica de pausa, reinicio y `preventDefault` ya probada.
- **No:** una API de entrada nueva en cada motor (`input.press`/`release`). Es más limpia a largo plazo, pero cambia el contrato y obliga a editar y verificar Asteroids, Tetris, Arkanoid, Serpentina y sus skins por un cambio que solo afecta a la capa de React.
- **No:** gestos sobre el canvas. Asteroids necesita girar, empujar y disparar a la vez, y Tetris necesita precisión de una celda; con gestos ambos serían incómodos.
- **Sí:** mando único para todos los juegos, decisión del usuario. Un solo componente, un solo CSS y una sola correspondencia que verificar.
- **No:** un mando distinto por juego. Quedaba más ergonómico, pero el usuario eligió la solución simple.
- **Sí:** atenuar los controles sin función en cada juego (`touchKeys`). Con un mando único evita que el jugador pulse botones muertos sin saber por qué.
- **Sí:** B como `KeyX`. Tetris ya lo acepta como segunda tecla de rotación, así que el mando tiene dos botones útiles allí sin añadir teclas nuevas a ningún motor.
- **Sí:** mostrar el mando solo con `@media (hover: none) and (pointer: coarse)`, decisión del usuario. Es CSS puro: el servidor y el cliente renderizan lo mismo, sin parpadeos ni avisos de hidratación; el criterio es el tipo de puntero, no el ancho de ventana.
- **No:** mostrarlo por ancho de pantalla. Enseñaría el mando en una ventana de escritorio estrecha y lo ocultaría en tablets grandes.
- **No:** interruptor de mostrar/ocultar persistido en `localStorage`. Más UI y más estado por una necesidad no demostrada.
- **Sí:** autorepetido solo para Tetris (`touchRepeat`), imitando el del teclado (170 ms de retardo, 50 ms de intervalo, `repeat: true`). Tetris actúa en cada `keydown` y en un móvil no existe el autorepetido del SO.
- **No:** autorepetido en Serpentina. Cada `keydown` encola un giro (máx. 2): repetir llenaría la cola con duplicados y retrasaría el siguiente giro real. Asteroids y Arkanoid usan estado mantenido y no lo necesitan.
- **Sí:** `PointerEvent` con `setPointerCapture` y un `pointerId` por botón. Da multitoque real y evita teclas "pegadas" cuando el dedo se desliza fuera del botón.
- **Sí:** liberar todas las teclas en `blur`, `visibilitychange`, `pointercancel` y desmontaje. Los motores pausan solos con `blur`/`visibilitychange`, pero sin `keyup` la tecla quedaría pulsada al reanudar.
- **Sí:** REINICIAR visible solo en `gameover` y PAUSA/SEGUIR siempre. Sin teclado, `Space` en `gameover` es indescubrible; el botón dedicado es el camino evidente. Además A también reinicia.
- **Sí:** rediseñar el layout a 390×844 como parte de este spec. Un mando que obliga a hacer scroll mientras se juega no es jugable; Tetris (1:2 con panel lateral) es el caso más ajustado.
- **Sí:** bloquear gestos del navegador (zoom, menú contextual, pull-to-refresh) solo sobre el juego y mientras está montado, para no afectar al resto del sitio.
- **No:** optimizar el modo apaisado. Se evita romperlo, pero los mandos laterales son otro diseño y otro spec.
- **No:** variantes del mando por skin. Los skins cambian lo que se dibuja dentro del canvas; el mando es parte del marco de la plataforma, como el HUD.
- **Sí:** `touchRepeat` y `touchKeys` en `GAMES_CONFIG`, junto al resto de configuración por juego, en lugar de detectarlo dentro del mando por `gameId`.
- **Sí:** validación manual con emulación táctil (Playwright con `isMobile`/`hasTouch`, o DevTools) y comprobación final en un teléfono real. Sin test runner en el repo.

## Risks

| Riesgo                                                                                                      | Mitigación                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un `keyup` perdido deja la nave girando o la pala moviéndose para siempre                                   | `releaseAll` en `pointerup`, `pointercancel`, `lostpointercapture`, `blur`, `visibilitychange`, `gameover` y cleanup; criterios específicos                            |
| Los eventos sintéticos no se comportan como los reales (`isTrusted`, `repeat`)                              | Los motores solo leen `e.code`, `e.repeat` y llaman a `preventDefault`; el hook fija `repeat` explícitamente; criterio de correspondencia con listener temporal        |
| El autorepetido de Tetris se siente distinto al del teclado                                                 | Constantes (170 ms / 50 ms) en una sola línea del hook, ajustables tras probar en un teléfono real                                                                     |
| `(hover: none) and (pointer: coarse)` no se cumple en algún navegador o en la emulación de Playwright       | Comprobar con `isMobile`/`hasTouch` y con DevTools; si la emulación del MCP no lo reproduce, se verifica con DevTools y un teléfono real y se anota en el cierre       |
| Tetris no cabe a 390×844 con HUD, panel lateral y mando                                                     | Altura del marco calculada con `dvh` y reducción manteniendo la proporción 1:2; criterio específico de Tetris; si no cabe, se compactan HUD y barra inferior en táctil |
| Teléfonos con barra de URL dinámica cambian la altura útil                                                  | Usar `dvh` y no `vh`; comprobar con la barra visible y oculta                                                                                                          |
| `touch-action: none` en el canvas impide hacer scroll para llegar al resto de la página                     | El mando y el canvas caben sin scroll a 390×844; el resto de la página sigue siendo desplazable desde fuera de esos elementos                                          |
| El cambio en `html` (`overscroll-behavior-y`) se queda activo al navegar fuera del juego                    | Se aplica en un efecto de `GameScreen` y se retira en el cleanup; criterio de aceptación                                                                               |
| El árbol de trabajo ya tiene cambios sin commitear en `components/game/game-screen.tsx` (selector de skins) | Implementar sobre ese estado; la rama de este spec debería partir tras commitear el trabajo de skins para no mezclar diffs                                             |
| Arkanoid sigue con `mousemove` y un toque puede mover la pala a un punto inesperado antes de usar ← y →     | Aceptado: no se modifica el motor; el comportamiento del toque sobre el canvas se anota como limitación conocida                                                       |

## What is **not** in this spec

- Cambios en `lib/games/**` (motores, skins, tipos) o en `references/`.
- Gestos sobre el canvas ni arrastre de la pala de Arkanoid.
- Mandos por juego, configurables o con interruptor.
- Diseño optimizado para apaisado.
- Mando distinto por skin.
- Vibración, sonido, giroscopio, gamepad físico o `WASD`.
- Detección de dispositivo por JavaScript.
- Cambios de reglas, puntuaciones, base de datos o leaderboard.
- Auth, anti-trampas y rate limit.
- Tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propio spec.
