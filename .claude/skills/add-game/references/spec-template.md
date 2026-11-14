# SPEC <NN> — Juego <TÍTULO> jugable con leaderboard

> **Status:** draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** <YYYY-MM-DD>
> **Objective:** <Una frase: portar/crear `<id>` como motor TypeScript, montarlo en `/juegos/<id>/jugar` y guardar su puntuación en el leaderboard existente.>

---

## Por qué existe este spec

<Contexto: qué es la fuente (`references/<carpeta>` o idea nueva), por qué no se puede usar tal cual (globals, DOM, listeners sin cleanup...) y qué patrón reutiliza (SPEC 05 motor + pantalla, SPEC 06 catálogo + `saveScore`).>

Archivos de referencia en `references/<carpeta>/` (solo port):

| Archivo | Contenido relevante |
| ------- | ------------------- |
| <...>   | <...>               |

## Scope

**In:**

- Motor en `lib/games/<id>/` (`constants.ts`, `utils.ts`, `entities.ts`, `game.ts`) con `createXGame(canvas, callbacks)` → `{ pause, resume, restart, destroy }`, sin cambiar reglas ni números de la fuente.
- Registro en `ENGINES` (`components/game/game-screen.tsx`) y en `PLAYABLE_GAME_IDS` (`lib/games.ts`).
- <Tamaño de canvas y cambios en `GameScreen` si no es 800×600.>
- <HUD: qué muestran Puntuación, Vidas y Nivel en este juego.>
- <Catálogo: fila existente en `games` / migración `add_game_<id>` + clase `cover-<id>`.>
- <Assets en `public/games/<id>/`.>
- <Semillas `is_seed`: conservar / borrar.>
- Guardado de score en GAME OVER mediante el `saveScore` existente (sin código de leaderboard nuevo).
- Pausa (`P`/`Escape`, `blur`, `visibilitychange`) y `preventDefault` de flechas/Espacio.
- Diseño de la UI nueva con `/frontend-design`.
- <Nota en `CLAUDE.md` si cambia el patrón.>

**Out of scope (para specs futuros):**

- Auth y anti-trampas (heredado de SPEC 06).
- Controles táctiles / gamepad.
- Sonido y música <salvo que se decida lo contrario>.
- Cambios de reglas o balance.
- Modificar `references/` o `lib/games/asteroids/`.
- Tests automatizados: el repo no tiene test runner.
- <Otros juegos.>

## Data model

Sin tablas nuevas. <Si hay fila nueva en `games`, incluir el `insert` y los valores.>

```ts
// lib/games/<id>/game.ts
export function create<X>Game(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameInstance;
```

| Archivo | Contenido |
| ------- | --------- |
| `lib/games/<id>/constants.ts` | <constantes copiadas literalmente> |
| `lib/games/<id>/utils.ts`     | <helpers> |
| `lib/games/<id>/entities.ts`  | <entidades> |
| `lib/games/<id>/game.ts`      | Estado en clausura, `update(dt)`, `draw()`, loop, input, pausa, `onHudChange`, `destroy` |

Convenciones: <puntos, controles, estados, `dt` ≤ 50 ms, HUD solo si cambia, `gameover` dispara el guardado>.

## Implementation plan

Antes de empezar: leer en `node_modules/next/dist/docs/` lo relativo a Client Components y `useEffect` con `cacheComponents` (y `revalidateTag` si hay fila nueva en `games`). Invocar `/frontend-design` antes del paso <N>.

1. **Tipos, constantes y utilidades.** <...> Verificar: `npx tsc --noEmit`.
2. **Entidades.** <...> Verificar: `npx tsc --noEmit` y `npm run lint`.
3. **Motor.** <estado, update, draw, loop, input, onHudChange, destroy> Verificar: `tsc` y `lint`.
4. **Pausa, foco y scroll.** <...> Verificar: `tsc` y `lint`.
5. **Catálogo.** <fila en `games` si es nueva + `cover-<id>`; semillas> Verificar: `select ... from games`, `get_advisors`.
6. **Registro e integración en `GameScreen`.** <`ENGINES`, `PLAYABLE_GAME_IDS`, canvas/HUD> Verificar: `/juegos/<id>/jugar` muestra el juego.
7. **Guardado y ranking.** Comprobar de punta a punta GAME OVER → `saveScore` → `/juegos/<id>` y `/salon`. Verificar con `execute_sql` y Playwright.
8. **Documentar.** <`CLAUDE.md` si aplica>. Verificar: `git diff` de `CLAUDE.md` solo muestra esa adición.

## Acceptance criteria

**Build**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] `lib/games/<id>/` no importa `react` ni `next/*`.
- [ ] `git grep -nE "^let |^var " -- lib/games` no devuelve resultados.
- [ ] No se modifica ningún archivo de `references/` ni `lib/games/asteroids/`.

**Integración**

- [ ] `/juegos/<id>/jugar` muestra el juego dentro del marco CRT.
- [ ] Los demás ids no jugables siguen mostrando «JUEGO PRÓXIMAMENTE»; `/juegos/inexistente/jugar` da 404; Asteroids sigue funcionando igual.
- [ ] SALIR navega a `/juegos/<id>`.
- [ ] La consola no muestra errores ni avisos de hidratación.

**Jugabilidad (manual)**

- [ ] <Una línea por regla de la fuente: controles, puntuación, niveles, vidas, powerups, condición de GAME OVER, reinicio.>

**HUD React**

- [ ] Puntuación, Vidas y Nivel coinciden con el estado del juego; `onHudChange` solo se invoca cuando cambia un campo.
- [ ] Jugador muestra el nombre de la sesión mock o `INVITADO`.

**Pausa, foco y teclado**

- [ ] `P` y `Escape` pausan y reanudan; el primer `dt` tras reanudar es 0.
- [ ] Cambiar de pestaña o perder el foco pausa el juego.
- [ ] Flechas y `Espacio` no desplazan la página.
- [ ] Al salir de la ruta no quedan loop ni listeners; el doble efecto de React 19 no duplica velocidad ni input.

**Guardado y leaderboard**

- [ ] Con sesión mock, un GAME OVER con puntuación > 0 inserta exactamente una fila en `scores` con `game_id = '<id>'`.
- [ ] La barra del marco muestra `GUARDANDO` y luego `GUARDADO #N`, con `N` igual al rango en `/salon`.
- [ ] Reiniciar y volver a perder inserta una segunda fila; pausar/reanudar no inserta filas extra.
- [ ] Puntuación 0 no se guarda; sin sesión aparece «INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN» y no se inserta nada.
- [ ] Si falla el guardado: `ERROR` + `REINTENTAR`, el juego sigue operativo.
- [ ] La fila aparece en `/juegos/<id>` y `/salon` sin reiniciar el servidor.
- [ ] `SCORE_LIMITS.maxScore` cubre la puntuación máxima plausible del juego.

**Rendimiento** (`references/performance.md`)

- [ ] En `update`/`draw` no hay `forEach`, `map`, `filter`, `concat` ni spread, ni objetos o arrays creados por frame.
- [ ] Fondo, sprites, degradados y `shadowBlur` se dibujan una vez en canvas fuera de pantalla, nunca por frame.
- [ ] `emitHud` solo crea el objeto cuando cambia un campo; `GameScreen` no re-renderiza por frame.
- [ ] El motor se crea una sola vez por carga y por cambio de vista; tras SALIR no quedan listeners ni `requestAnimationFrame` pendientes.
- [ ] Medido con la CPU a 20× sobre el build de producción: la tabla (frame medio, p95, tareas largas) queda en el spec, y cada optimización de `performance.md` §2 que aplica al juego está hecha o descartada con razón en *Decisions*.

**Visual (manual)**

- [ ] Canvas completo, 4:3 o su proporción real, sin scroll vertical a 1440×900 y 1366×650; sin desborde horizontal a 390×844.
- [ ] Overlays `PAUSA` y `GAME OVER` legibles.

**Sin efectos colaterales**

- [ ] Ninguna clave secreta ni `service_role` en el repo.
- [ ] `git status` lista solo `lib/games/<id>/`, `lib/games.ts`, `components/game/`, <`public/games/<id>/`>, <`supabase/migrations/`>, <`app/globals.css`>, <`CLAUDE.md`> y este spec.

## Decisions

- **Sí/No:** <decisión>. <Razón y alternativa descartada.>
- <Tamaño de canvas, HUD sin vidas/nivel, assets, semillas, sonido...>

## Risks

| Riesgo | Mitigación |
| ------ | ---------- |
| React 19 ejecuta `useEffect` dos veces en desarrollo y duplica loop/listeners | `destroy()` cancela rAF y retira cada listener; criterio de aceptación sobre el doble efecto |
| `preventDefault` global rompe la navegación por teclado | Listeners solo mientras `GameScreen` está montado |
| Comportamiento distinto al original tras el port | Constantes y reglas copiadas literalmente; checklist de jugabilidad |
| Doble guardado en `gameover` | Una llamada por transición (lógica de `GameScreen`); criterio sobre filas insertadas |
| <Riesgos propios del juego> | <...> |

## What is **not** in this spec

- <Lista espejo de *Out of scope*.>

Cada uno de estos puntos, si se aborda, va en su propio spec.
