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

_Se rellena durante la implementación (pasos 2 y 6)._

| Juego       | Skin | Frame medio (ms) antes → después | Frame p95 (ms) | Tareas largas | Heap/10 s (KB) | Renders React/s |
| ----------- | ---- | -------------------------------- | -------------- | ------------- | -------------- | --------------- |
| _pendiente_ |      |                                  |                |               |                |                 |

## What is **not** in this spec

- Rendimiento de Next fuera de la pantalla de juego: caché, Suspense, JS del cliente, fuentes, imágenes, `public/games/**`.
- Cambios de reglas, hitboxes, velocidades, puntuación, aspecto o resolución interna de los canvas.
- Calidad adaptativa, `OffscreenCanvas` en Worker, WebGL o WASM.
- Umbrales numéricos de fps.
- Base de datos, leaderboard, `saveScore`, Auth.
- Tests automatizados y nuevas dependencias.

Cada uno de estos puntos, si se aborda, va en su propio spec.
