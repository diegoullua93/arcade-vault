# SPEC 11 — Optimización de rendimiento de los juegos y guía para juegos nuevos

> **Status:** approved
> **Depends on:** SPEC 05, SPEC 07, SPEC 08, SPEC 09, SPEC 10 (y el sistema de skins de `lib/games/skins.ts`)
> **Date:** 2026-11-05
> **Objective:** Medir el rendimiento de los cuatro juegos en sus tres skins, optimizar los motores (`lib/games/**`) y la capa React de la pantalla de juego (`components/game/**`) sin cambiar jugabilidad ni aspecto, y fijar una guía de rendimiento que cumplan los juegos nuevos.

---

## Por qué existe este spec

Hay cuatro motores de canvas (Asteroids, Tetris, Arkanoid, Serpentina), tres skins por juego y un mando táctil, y nadie ha medido cuánto cuesta cada frame. El rendimiento solo se ha revisado "a ojo". El objetivo es que el juego sea fluido en cualquier dispositivo (también móvil de gama media) y que los juegos que se añadan con `/add-game` + `/spec-impl` + `skin-designer` + `mobil-porter` nazcan ya sin los antipatrones que se encuentren.

Se opta por **medir primero**: no se optimiza por intuición. Una búsqueda rápida muestra dónde mirar (no es un diagnóstico, solo candidatos a verificar con la medición):

| Candidato                                                   | Dónde aparece                                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `shadowBlur` / degradados por frame                         | `arkanoid/skins/neon.ts`, `asteroids/game.ts` (muchas coincidencias), `tetris/skins/*`, `serpentina/draw.ts` |
| Asignaciones por frame (`.map`, `.filter`, `.forEach`)      | `asteroids/game.ts`, `arkanoid/game.ts`, `tetris/game.ts`                                                    |
| Canvas fuera de pantalla creados fuera de la inicialización | skins de Tetris y Arkanoid                                                                                   |
| Re-renders de React por `onHudChange` en cada frame         | `components/game/game-screen.tsx`                                                                            |
| Recreación del motor ante cambios de estado no relacionados | `useEffect` de creación del motor en `game-screen.tsx`                                                       |

Este spec **levanta, solo para este trabajo,** la regla de SPEC 10 «no tocar `lib/games/**`». La regla del agente `mobil-porter` (nunca toca `lib/games/**`) no cambia.

## Scope

**In:**

- **Línea base (antes)**: perfilar con Playwright MCP, sobre `npm run build` + `npm start` (no el servidor de desarrollo), los 4 juegos × 3 skins (Tetris con su canvas de siguiente pieza), con un guion de entrada idéntico en cada pasada. Métricas:
  - tiempo de frame medio y p95 durante 10 s (muestreo con `requestAnimationFrame`),
  - nº de tareas largas (> 50 ms, `PerformanceObserver` con `longtask`),
  - crecimiento del heap de JS en esos 10 s (`performance.memory` en Chromium) como indicador de asignaciones por frame,
  - nº de renders de React de `GameScreen` por segundo de juego.
    Cada medición se repite 3 veces y se toma la mediana. Se intenta además la pasada con CPU limitada (CDP `Emulation.setCPUThrottlingRate`, 4×) a 390×844 con emulación táctil; si el MCP no la permite, se anota.
- **Motores** (`lib/games/**`), sin cambiar reglas ni dibujo:
  - eliminar asignaciones por frame en el bucle (arrays/objetos/closures temporales, `.map`/`.filter` en el camino caliente), reutilizando buffers o actualizando en sitio;
  - no crear degradados, patrones, `Path2D` ni canvas por frame: cachearlos en la creación del skin o en un canvas fuera de pantalla;
  - reducir cambios de estado del contexto 2D (agrupar por color/estilo, evitar `shadowBlur` repetido, restablecerlo una sola vez);
  - un único `requestAnimationFrame` por motor, con `dt` acotado, y `destroy()` que sigue cancelando rAF y retirando todos los listeners;
  - no dibujar ni simular mientras el juego está en pausa o `gameover` más allá de lo necesario (el overlay se dibuja una vez, no en cada frame, si el resultado es idéntico);
  - dibujar el `bitmap-font` y las cadenas de texto de forma que no se recalculen medidas/cadenas en cada frame cuando no cambian.
- **Capa React** (`components/game/**`):
  - `onHudChange` solo provoca re-render cuando cambia un valor mostrado (puntuación, nivel, vidas, estado), no en cada frame;
  - el motor no se recrea por cambios ajenos a `gameId`/`skin` (dependencias del efecto);
  - callbacks y configuración estables (`useCallback`/`useMemo` solo donde la medición lo justifique, o referencias fuera del componente);
  - el mando táctil y `use-touch-keys.ts` no re-renderizan por cada evento de puntero ni crean temporizadores de más;
  - el canvas de «siguiente pieza» de Tetris solo se redibuja cuando cambia la pieza.
- **Guía para juegos nuevos**: `.claude/skills/add-game/references/performance.md` con el checklist de reglas de arriba (presupuesto por frame, qué se cachea, qué está prohibido en el bucle, cómo medir). Se enlaza desde:
  - `.claude/skills/add-game/SKILL.md` y `references/engine-contract.md` (el spec generado debe incluir un criterio de aceptación de rendimiento),
  - los agentes `skin-designer` y `mobil-porter` (una línea: leer la guía y cumplirla en su capa),
  - `CLAUDE.md` (Architecture notes, una línea).
- **Medición final (después)** con el mismo guion y las mismas métricas, y tabla antes/después en la sección _Resultados de medición_ de este mismo spec (se rellena al cerrar la implementación).

**Out of scope (para specs futuros):**

- Rendimiento de Next fuera de la pantalla de juego: caché y Suspense de rutas, JS del cliente, fuentes, imágenes, `public/games/**`, bundle.
- Cambiar reglas, hitboxes, velocidades, puntuación, aspecto visual o resolución interna de los canvas.
- Nuevos mecanismos de calidad adaptativa (bajar efectos según el dispositivo), `OffscreenCanvas` en Web Worker, WebGL o WASM.
- Presupuestos numéricos de fps como criterio de aceptación (no se fija umbral; ver Decisions).
- Base de datos, leaderboard, `saveScore` y Auth.
- Tests automatizados: el repo no tiene test runner.
- Añadir dependencias.

## Data model

Sin tablas, columnas ni migraciones. Sin persistencia. Se añaden dos artefactos de documentación:

```text
.claude/skills/add-game/references/performance.md   # guía y checklist de rendimiento
specs/11-optimizacion-rendimiento.md                # sección «Resultados de medición» (tabla antes/después)
```

Forma de la tabla de resultados (una fila por juego × skin):

| Juego | Skin | Frame medio (ms) antes → después | Frame p95 (ms) | Tareas largas | Heap/10 s (KB) | Renders React/s |
| ----- | ---- | -------------------------------- | -------------- | ------------- | -------------- | --------------- |

Las firmas públicas de los motores (`createXGame(canvas, callbacks, options?)` → `{ pause, resume, restart, destroy }`) y de `GameScreen` no cambian.

## Implementation plan

Antes de empezar: leer en `node_modules/next/dist/docs/` lo relativo a Client Components y `useEffect` con `cacheComponents`. Crear la rama `spec-11-optimizacion-rendimiento` (la crea `/spec-impl`).

1. **Guion de medición.** Escribir (en el scratchpad, no en el repo) un guion reproducible para Playwright que, por juego y skin, abre `/juegos/<id>/jugar`, ejecuta la misma secuencia de teclas sintéticas durante 10 s y recoge las cuatro métricas con 3 repeticiones. Verificar: dos ejecuciones seguidas sobre el mismo código dan medianas comparables.
2. **Línea base.** Con `npm run build` + `npm start`, medir los 4 juegos × 3 skins (y la pasada con CPU limitada si el MCP lo permite). Registrar la columna «antes» en la sección _Resultados de medición_ y la lista priorizada de hallazgos (de mayor a menor coste). Verificar: tabla completa, sin celdas vacías (salvo la pasada con CPU limitada, si no es posible, anotada).
3. **Motores.** Por juego, aplicar las optimizaciones de los hallazgos (un commit lógico por juego, sin commitear salvo que se pida). Tras cada juego: `npm run lint`, `npx tsc --noEmit`, partida real en los 3 skins y comparación de capturas con las de antes (mismo aspecto). Verificar: jugabilidad idéntica (puntuación y niveles igual para el mismo guion) y sin errores en consola.
4. **Capa React.** Aplicar las optimizaciones de `game-screen.tsx`, `touch-controls.tsx`, `use-touch-keys.ts` y `use-skin.ts` según los hallazgos. Verificar: el selector de skins, el mando táctil, la pausa, el reinicio y el guardado de puntuación siguen funcionando; el doble efecto de React 19 en desarrollo no duplica motores ni temporizadores.
5. **Guía para juegos nuevos.** Escribir `references/performance.md` con las reglas confirmadas por la medición y enlazarla desde `add-game`, `engine-contract.md`, los agentes `skin-designer` y `mobil-porter` y `CLAUDE.md`. Verificar: `git diff` de esos archivos muestra solo las líneas de enlace y la guía.
6. **Medición final.** Repetir el paso 2 con el mismo guion y rellenar la columna «después». Si alguna métrica empeora, localizar el cambio responsable y corregirlo o revertirlo. Verificar: ninguna métrica empeora respecto a la línea base (criterio de Acceptance).
7. **Cierre.** `npm run lint`, `npx tsc --noEmit`, `npm run build`, comprobación en navegador (escritorio y emulación táctil) y actualización de `CLAUDE.md` si cambia algún contrato. Verificar: ver Acceptance criteria.

## Acceptance criteria

**Build**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] No se añade ninguna dependencia a `package.json`.
- [ ] El diff no toca `supabase/`, `references/`, `app/juegos/[id]/jugar/actions.ts` ni `lib/leaderboard.ts`.
- [ ] `git grep -nE "^let |^var " -- lib/games components/game` no devuelve resultados.
- [ ] Los motores siguen sin importar React ni Next, y `destroy()` cancela el rAF y retira todos los listeners (se comprueba creando y destruyendo cada motor 5 veces seguidas sin errores ni eventos duplicados).

**Medición**

- [ ] La sección _Resultados de medición_ tiene la tabla antes/después completa para los 4 juegos × 3 skins, medida sobre build de producción, con mediana de 3 repeticiones y el mismo guion.
- [ ] Ninguna métrica de la tabla empeora: «empeora» significa que la mediana final supera el peor de los 3 valores de la línea base.
- [ ] El heap de JS crece menos o igual que en la línea base en cada juego y skin.
- [ ] Los renders de `GameScreen` por segundo de juego son menores o iguales que en la línea base, y no hay un render por frame.

**Jugabilidad y aspecto idénticos**

- [ ] Con el mismo guion de teclas, puntuación, nivel y estado final coinciden con los de la línea base en cada juego (los motores con aleatoriedad se comparan por reglas y no por valores exactos).
- [ ] Capturas de cada juego en cada skin (jugando, pausa y `gameover`) coinciden visualmente con las de antes de optimizar.
- [ ] El teclado y el mando táctil siguen funcionando igual (correspondencia de teclas, multitoque y liberación de teclas de SPEC 10).
- [ ] La puntuación se sigue guardando una sola vez por partida (`GUARDANDO` → `GUARDADO #N`).
- [ ] Cambiar de skin con una partida en curso sigue pidiendo confirmación y recrea el motor.
- [ ] La consola no muestra errores ni avisos de hidratación en las cuatro rutas de juego, en escritorio y en emulación táctil.

**Capa React**

- [ ] Reproducir una partida de 10 s no provoca más renders de `GameScreen` que cambios reales de valores mostrados (puntuación, nivel, vidas, estado).
- [ ] El canvas de «siguiente pieza» de Tetris no se redibuja si la pieza no cambia.

**Guía para juegos nuevos**

- [ ] Existe `.claude/skills/add-game/references/performance.md` con reglas verificables (qué no se hace en el bucle, qué se cachea, cómo medir).
- [ ] La guía está enlazada desde `.claude/skills/add-game/SKILL.md`, `references/engine-contract.md`, `.claude/agents/skin-designer.md`, `.claude/agents/mobil-porter.md` y `CLAUDE.md`.
- [ ] Una plantilla de spec generada por `/add-game` incluye un criterio de aceptación de rendimiento.

## Decisions

- **Sí:** medir antes y después, decisión del usuario. Sin números no hay forma de saber si un cambio ayuda; el repo no tiene test runner, así que la evidencia es la tabla del propio spec.
- **Sí:** medir sobre build de producción y no sobre `next dev`: el servidor de desarrollo añade Strict Mode, doble efecto y HMR que falsean frame time y renders.
- **Sí:** alcance en motores, capa React de la pantalla de juego y guía para juegos nuevos, decisión del usuario. Es donde está el coste en tiempo de ejecución y lo que cualquier juego nuevo hereda.
- **No:** rendimiento de Next/bundle/assets. Es otra área (caché, carga, imágenes) con otras herramientas; va en su propio spec.
- **Sí:** jugabilidad y aspecto idénticos, decisión del usuario. Si un efecto es muy caro se propone en otro spec; aquí no se quita ni se simplifica.
- **Sí:** sin umbral numérico de fps, decisión del usuario. El criterio es relativo: nada empeora respecto a la línea base y las mejoras quedan registradas.
- **Sí:** conservar una optimización aunque no mejore la métrica si deja el código más limpio y no empeora nada, decisión del usuario. Se anota en esta sección cuáles se conservaron sin mejora medible.
- **Sí:** mediana de 3 repeticiones y «empeora = por encima del peor valor de la línea base». Absorbe el ruido de la medición sin fijar un umbral inventado.
- **Sí:** levantar para este spec la regla «no tocar `lib/games/**`» de SPEC 10. Es imprescindible para optimizar motores y skins; `mobil-porter` mantiene su regla propia.
- **No:** calidad adaptativa, `OffscreenCanvas` en Worker, WebGL o WASM. Son rediseños, no optimizaciones de lo existente.
- **Sí:** la guía vive en `add-game/references/performance.md` y se enlaza desde los agentes, decisión del usuario. Es el sitio donde ya viven el contrato del motor y la integración, y los agentes ya los leen.
- **Sí:** guion de medición en el scratchpad y no en el repo. Evita añadir tooling que el repo no usa (no hay test runner); la tabla del spec documenta el método.
- **Sí:** medir con la CPU limitada 20×, no 4×. A velocidad normal y a 4× el navegador está limitado por vsync (16,7 ms) y no distingue versiones; a 20× aparece el coste real por frame.
- **No (descartado tras medir):** dibujar todos los asteroides y todas las balas en un solo trazo. No es más rápido (a 20 asteroides, 2,65 ms frente a 2,0–2,1 ms) y cambia los píxeles de los bordes (hasta 188 niveles donde se cruzan los trazos). Se revirtió; `entities.ts` de Asteroids queda sin cambios.
- **Sí:** capa fuera de pantalla para el tablero asentado de Tetris y para fondo + bloques de Arkanoid, con contador de versión. Es exacta porque se repinta con las mismas operaciones y orden, y porque los `drawBlock` de los skins son puros.
- **Sí:** saltar los frames sin cambios en Tetris con `isAnimating?` opcional en los skins (si falta se repinta siempre; al terminar una animación se pinta un frame más). No aplica a Arkanoid, Asteroids ni Serpentina, donde algo se mueve en cada frame.
- **Sí:** repintado parcial con `clip` en Serpentina (solo moneda y destellos entre pasos), con repintado completo en cada paso de la serpiente y mientras hay overlay.
- **Sí:** `useHydrated()` y esperar a hidratar antes de crear el motor. Con una vista guardada distinta de `neon` se construía y destruía un motor por recarga; con el cambio hay exactamente uno.
- **No:** `useCallback`/`useMemo` en la pantalla de juego. La medición de renders no los justificó (nunca hay un render por frame).
- **No (fuera de alcance, candidato a un spec futuro):** los efectos CSS de fondo de la página (`.av-bg`, ruido SVG, scanlines con `mix-blend-mode`, `backdrop-filter` de la nav). Medido en Serpentina, cuestan ≈ 27 ms por frame a 20×, casi lo mismo que el motor entero, pero son globales y tocarlos puede cambiar el aspecto del sitio.
- **Sí:** distancias con el cuadrado en Asteroids en lugar de `Math.hypot`. Es matemáticamente lo mismo; solo podría diferir en el último bit justo en el borde exacto de una colisión.

## Risks

| Riesgo                                                                                             | Mitigación                                                                                                                           |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Una optimización cambia sin querer el aspecto o la lógica                                          | Criterios de capturas idénticas y de puntuación/nivel iguales con el mismo guion; un juego a la vez                                  |
| El frame time en Playwright es ruidoso (headless, sin vsync real)                                  | Mediana de 3 repeticiones, mismo guion y criterio relativo; si el ruido tapa la señal se anota y se apoya en heap y renders de React |
| `performance.memory` solo existe en Chromium y es grueso                                           | Se usa solo como indicador comparativo; el MCP corre en Chromium. Se anota si no está disponible                                     |
| No se puede limitar la CPU desde el MCP                                                            | La pasada con CPU limitada es intento, no requisito; se documenta y se pide prueba en teléfono real                                  |
| Los motores con aleatoriedad (Tetris, Serpentina, Asteroids) dan partidas distintas en cada pasada | Comparar por reglas y por el coste por frame, no por valores exactos; el guion de teclas es el mismo                                 |
| Sobre-optimizar con memoización en React sin evidencia                                             | Solo se añade `useCallback`/`useMemo` donde la medición de renders lo justifique                                                     |
| La guía queda desfasada respecto al código                                                         | Se escribe a partir de lo confirmado por la medición y se enlaza desde `add-game`, que obliga a leerla                               |
| El árbol de trabajo tiene cambios sin commitear (`CLAUDE.md`, agente `mobil-porter`, SPEC 10)      | Commitear o separar ese trabajo antes de crear la rama de este spec para no mezclar diffs                                            |

## Resultados de medición

### Método (paso 2, línea base «antes»)

- Build de producción (`next build` + `next start -p 3100`), Chromium de Playwright MCP, escritorio, sin sesión (jugador `INVITADO`).
- Por juego y skin: 3 repeticiones de 10 s con el mismo guion de teclas sintéticas (un paso cada 120 ms), tras recargar y esperar 1,5 s y forzar un GC. Si el juego llega a `gameover` el guion lo reinicia con `Espacio`.
- Cada celda es **mediana (peor de las 3)**. El peor valor es el umbral del criterio «ninguna métrica empeora».
- Solo **Tetris** y **Arkanoid** tienen 3 skins hoy (`skins: true` en `GAMES_CONFIG`); **Asteroids** y **Serpentina** tienen un solo aspecto (`skins: false`) y se miden una vez.
- «Renders React/s» son commits de React por segundo (hook mínimo de DevTools); incluye todos los roots, no solo `GameScreen`.
- Los guiones de teclas son deterministas pero los motores usan aleatoriedad (piezas, asteroides, núcleos), así que puntuación y nivel no son idénticos entre pasadas.

### Pasada normal (CPU sin limitar)

El navegador queda limitado por vsync: todos los juegos dan 16,7 ms por frame y no hay tareas largas, así que **esta pasada no distingue entre versiones**. Solo sirve de comprobación de que no hay regresión grave. Con la CPU limitada 4× el resultado es el mismo (p. ej. Asteroids: 16,7 ms de media), por eso se usa 20×.

| Juego      | Skin    | Frame medio (ms) | Frame p95 (ms) | Tareas largas | Heap/10 s (KB) | Renders React/s |
| ---------- | ------- | ---------------- | -------------- | ------------- | -------------- | --------------- |
| Asteroids  | único   | 16,69 (16,69)    | 16,8 (16,8)    | 0 (0)         | 607 (795)      | 1,1 (1,1)       |
| Serpentina | único   | 16,69 (16,69)    | 16,8 (16,8)    | 0 (0)         | 624 (624)      | 0 (0)           |
| Tetris     | neon    | 16,67 (16,69)    | 17,0 (17,0)    | 0 (0)         | 739 (740)      | 1,5 (1,5)       |
| Tetris     | classic | 16,67 (16,69)    | 17,0 (17,0)    | 0 (0)         | 581 (1043)     | 1,5 (1,5)       |
| Tetris     | mario   | 16,67 (16,72)    | 16,9 (17,0)    | 0 (0)         | 744 (752)      | 1,5 (1,5)       |
| Arkanoid   | neon    | 16,69 (16,69)    | 17,0 (17,0)    | 0 (0)         | 379 (738)      | 0,9 (0,9)       |
| Arkanoid   | classic | 16,72 (16,75)    | 17,0 (17,0)    | 0 (0)         | 609 (656)      | 0,9 (0,9)       |
| Arkanoid   | mario   | 16,67 (16,67)    | 16,9 (17,0)    | 0 (0)         | 1009 (1052)    | 0,9 (0,9)       |

### Pasada con CPU limitada 20× (CDP `Emulation.setCPUThrottlingRate`)

Es la pasada que discrimina. A 20× los juegos corren a unos 8–14 fps y el tiempo de frame refleja el coste real por frame.

| Juego      | Skin    | Frame medio (ms) | Frame p95 (ms) | Tareas largas | Heap/10 s (KB) | Renders React/s |
| ---------- | ------- | ---------------- | -------------- | ------------- | -------------- | --------------- |
| Asteroids  | único   | 80,3 (97,1)      | 166,6 (200,1)  | 109 (113)     | 1048 (1058)    | 0,6 (0,6)       |
| Serpentina | único   | 72,5 (73,6)      | 100,3 (116,7)  | 107 (115)     | 202 (211)      | 0 (0)           |
| Tetris     | neon    | 72,3 (74,2)      | 150,1 (166,7)  | 88 (103)      | 578 (607)      | 1,2 (1,3)       |
| Tetris     | classic | 76,1 (76,1)      | 166,6 (166,6)  | 101 (104)     | 759 (798)      | 1,1 (1,19)      |
| Tetris     | mario   | 88,6 (90,7)      | 183,2 (183,3)  | 116 (117)     | 683 (694)      | 0,9 (0,9)       |
| Arkanoid   | neon    | 119,0 (122,7)    | 183,4 (183,4)  | 87 (91)       | 794 (838)      | 0,3 (0,3)       |
| Arkanoid   | classic | 120,4 (129,5)    | 166,7 (216,7)  | 86 (87)       | 601 (619)      | 0,3 (0,3)       |
| Arkanoid   | mario   | 126,1 (134,4)    | 199,9 (233,4)  | 82 (87)       | 766 (976)      | 0,3 (0,6)       |

### Hallazgos de la línea base (hipótesis para el paso 3)

1. **Arkanoid es el más caro** (≈ 119–126 ms/frame a 20×) y **mario** es el skin más caro en Tetris (88,6 frente a 72–76 ms) y en Arkanoid.
2. **Serpentina y Tetris cuestan ≈ 72 ms/frame a 20× siendo juegos muy simples** (Serpentina no tiene React por frame: 0 commits/s). Un coste tan alto y parecido entre juegos distintos apunta a un coste fijo por frame (relleno del canvas, capas CSS del marco CRT, composición) más que a la lógica del motor. **Primer experimento del paso 3:** medir la pantalla de juego con el motor en pausa y sin efectos CRT para separar el coste de los motores del de la página.
3. **React no es el cuello de botella**: 0–1,5 commits/s, ningún render por frame. Los puntos de la capa React se limitan a lo que midan los renders (p. ej. `onHudChange` en Asteroids y Tetris).
4. **El heap de 10 s es una métrica débil**: todos los juegos crecen menos de 1,1 MB y la tercera repetición suele salir más baja (GC). Se mantiene como indicador secundario; la señal principal es el frame medio/p95 y las tareas largas a 20×.
5. El número de tareas largas a 20× (≈ 80–117 en 10 s) es casi uno por frame, es decir, no discrimina entre juegos; se conserva para detectar regresiones.

### Medición final «después» (paso 6)

Mismo guion, build de producción de la rama (motores + `useHydrated`), navegador limpio (sin la instrumentación del paso 4, que falseó una primera pasada). Formato: mediana (peor de las 3).

**Pasada normal (1×).** Sigue limitada por vsync: frame medio 16,67 ms y 0 tareas largas en las 8 combinaciones; p95 entre 17,0 y 17,1 ms (la diferencia de 0,1 ms con la línea base es ruido de vsync).

| Juego      | Skin    | Heap/10 s (KB) | Renders React/s |
| ---------- | ------- | -------------- | --------------- |
| Asteroids  | único   | 602 (685)      | 1,2 (1,9)       |
| Serpentina | único   | 458 (463)      | 0 (0)           |
| Tetris     | neon    | 732 (732)      | 1,5 (1,5)       |
| Tetris     | classic | 795 (805)      | 1,5 (1,5)       |
| Tetris     | mario   | 841 (910)      | 1,5 (1,5)       |
| Arkanoid   | neon    | 484 (551)      | 0,9 (0,9)       |
| Arkanoid   | classic | 1441 (1442)    | 0,9 (0,9)       |
| Arkanoid   | mario   | 454 (1862)     | 0,9 (0,9)       |

**Pasada con CPU limitada 20×.**

| Juego      | Skin    | Frame medio (ms) | Frame p95 (ms) | Tareas largas | Heap/10 s (KB) | Renders React/s |
| ---------- | ------- | ---------------- | -------------- | ------------- | -------------- | --------------- |
| Asteroids  | único   | 32,4 (34,0)      | 50,0 (50,1)    | 1 (2)         | 857 (881)      | 0,9 (1,2)       |
| Serpentina | único   | 28,6 (29,1)      | 33,5 (33,5)    | 0 (0)         | 301 (364)      | 0 (0)           |
| Tetris     | neon    | 49,6 (58,2)      | 166,7 (216,6)  | 38 (49)       | 493 (706)      | 1,0 (1,5)       |
| Tetris     | classic | 42,2 (52,5)      | 100,0 (166,6)  | 43 (58)       | 673 (771)      | 1,3 (1,5)       |
| Tetris     | mario   | 58,7 (101,2)     | 150,1 (283,3)  | 59 (63)       | 570 (806)      | 1,0 (1,49)      |
| Arkanoid   | neon    | 41,4 (64,7)      | 83,3 (150,1)   | 19 (60)       | 798 (1772)     | 0,9 (3,6)       |
| Arkanoid   | classic | 32,6 (34,5)      | 50,1 (50,1)    | 8 (9)         | 626 (850)      | 0,8 (1,5)       |
| Arkanoid   | mario   | 34,2 (38,8)      | 66,6 (66,7)    | 9 (15)        | 677 (1121)     | 0,8 (1,0)       |

### Estado de la verificación (lo que NO está cerrado)

- **La comparación antes/después no es limpia.** La línea base y esta medición son de sesiones distintas y el ordenador cambia de carga entre ellas: Serpentina dio 72,5 ms en la línea base, 65,0 ms recién optimizada y 28,6 ms en la pasada final; en Tetris las repeticiones de una misma pasada oscilan entre 25 y 101 ms. Con esa deriva, «ninguna métrica empeora» **no se puede afirmar con rigor** (hay valores peores que el peor de la línea base: Tetris neón p95 216,6 > 166,7, Tetris mario frame 101,2 > 90,7, y el heap en varias skins).
- **Comparación A/B en la misma sesión (pendiente).** Se construyó el código anterior (commit `9a513d8`, `git worktree` en `../arcade-vault-baseline`, puerto 3101) para medir «antes» y «después» alternados, repetición a repetición. Una primera ejecución salió inservible (carga puntual del equipo: Tetris a 150–550 ms por frame en ambos lados, 19 frames en 10 s en una repetición); una segunda quedó en marcha en segundo plano al cerrar esta sesión y **su resultado no está incorporado**. En la ejecución inservible, aun así, Arkanoid salió mejor en las 9 parejas (≈ 25 % en neón y classic, ≈ 45 % en mario) y Tetris mario en las 3; Asteroids, Serpentina y Tetris neón/classic salieron mezclados.
- **Qué sí está comprobado:** equivalencia de píxeles (0 diferencias > 16 en Tetris y Arkanoid con las 3 skins, y en Serpentina; Asteroids por equivalencia de las operaciones), listeners/rAF/intervalos a 0 tras SALIR, un único motor por carga, `tsc` y `eslint` limpios.
- **Para cerrar el spec:** repetir el A/B con el equipo en reposo, anotar sus medianas y marcar los criterios de _Medición_; solo entonces pasar `Status` a `implemented`. Después limpiar: `git worktree remove ../arcade-vault-baseline --force` y parar los servidores de los puertos 3100 y 3101.

### Limitaciones de las métricas

- **Heap/10 s:** diente de sierra del recolector (ruido de ±500 KB, con repeticiones bimodales); es indicador, no veredicto.
- **Renders React/s:** dependen del tiempo de juego simulado por ventana (a 20× el motor recorta cada frame a 50 ms), no solo del código; nunca hay un render por frame.
- **Tareas largas:** a 20× casi todos los frames lo son en la línea base, así que solo sirven para detectar regresiones.
- **Pasada a 1×:** limitada por vsync (16,67 ms); no distingue versiones.

## What is **not** in this spec

- Rendimiento de Next fuera de la pantalla de juego: caché, Suspense, JS del cliente, fuentes, imágenes, `public/games/**`.
- Cambios de reglas, hitboxes, velocidades, puntuación, aspecto o resolución interna de los canvas.
- Calidad adaptativa, `OffscreenCanvas` en Worker, WebGL o WASM.
- Umbrales numéricos de fps.
- Base de datos, leaderboard, `saveScore`, Auth.
- Tests automatizados y nuevas dependencias.

Cada uno de estos puntos, si se aborda, va en su propio spec.
