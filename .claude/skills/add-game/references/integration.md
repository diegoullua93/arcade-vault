# Integración de un juego en la plataforma

Puntos que todo spec de juego debe cubrir. Verifica las rutas en el código antes de citarlas: son las vigentes tras SPEC 05/06.

## 1. Registro

- `components/game/game-screen.tsx`: añadir `<id>: createXGame` al mapa `ENGINES`.
- `lib/games.ts`: añadir el id a `PLAYABLE_GAME_IDS`. `saveScore` y `app/juegos/[id]/jugar/page.tsx` dependen de esta lista (los ids fuera de ella siguen mostrando «JUEGO PRÓXIMAMENTE»).

## 2. Canvas y `GameScreen`

`GameScreen` fue escrito para Asteroids: `<canvas width={800} height={600}>` y marco CRT 4:3. Si el juego tiene otro tamaño interno (p. ej. Tetris 300×600), el spec debe decidir cómo se parametriza (p. ej. `size` junto a la fábrica en `ENGINES`, o un objeto `{ create, width, height }`) sin cambiar Asteroids, y cómo se limita por `100dvh`. Criterio visual: sin scroll vertical a 1440×900 y 1366×650; sin desborde horizontal a 390×844.

HUD: `GameScreen` pinta Jugador, Puntuación, Vidas (corazones) y Nivel (2 dígitos). Si el juego no tiene vidas o nivel, el spec define qué se muestra. Cualquier UI nueva se diseña con `/frontend-design` y los `@keyframes` nuevos llevan prefijo `av-`.

## 3. Catálogo (`games`)

- **Activar un juego exige `games.playable = true`** (SPEC 14): la política `scores_insert_own` rechaza marcas de juegos con `playable = false`, aunque el id esté en `PLAYABLE_GAME_IDS`. Los 4 jugables actuales (`asteroids`, `tetris`, `arkanoid`, `serpentina`) ya lo tienen. Mantén `playable` y `PLAYABLE_GAME_IDS` sincronizados.
- Los juegos no jugables que ya tienen fila (`gloton`, `invasores`, `ranaria`, `duelo-pixel`) solo necesitan una migración `supabase/migrations/<timestamp>_activate_<id>.sql`: `update public.games set playable = true where id = '<id>';`.
- Un id nuevo necesita fila: migración `supabase/migrations/<timestamp>_add_game_<id>.sql` aplicada con `apply_migration`, que ya lo marca como jugable:

```sql
insert into public.games (id, title, short, long, category, cover, color, sort_order, playable)
values ('<id>', '<TÍTULO>', '<corto>', '<largo>', 'ARCADE', 'cover-<id>', 'cyan',
        (select coalesce(max(sort_order), 0) + 1 from public.games), true);
```

Aplícala también en producción (ver `docs/produccion.md`) y regenera `supabase/prod/01-schema.sql` con `bash supabase/prod/build-schema.sh` solo si aún no se ha hecho el despliegue inicial.

  y la clase `cover-<id>` en `app/globals.css`. El catálogo está cacheado (`use cache`, `cacheTag("games")`): tras insertar hay que invalidar o redesplegar. El home muestra 6 juegos y `/biblioteca` todos.
- El texto `long` del catálogo debe corresponder a las reglas reales del juego (en SPEC 05 se dejó una discrepancia sobre OVNIs); anótalo en el spec.
- No hace falta regenerar `lib/supabase/database.types.ts` salvo que cambie el esquema (el cambio de datos de `playable` no lo cambia).

## 4. Leaderboard y guardado

No hay código de leaderboard por juego: `scores`, `game_stats`, `get_leaderboard`, `get_player_best`, `/juegos/[id]`, `/salon` y `saveScore` ya son genéricos por `game_id`.

- `saveScore` solo exige que el id esté en `PLAYABLE_GAME_IDS` y score entero entre 1 y `SCORE_LIMITS.maxScore` (9 999 999, también `CHECK` en la tabla). El spec debe comprobar que la puntuación máxima plausible del juego cabe; si no, requiere migración + cambio de `lib/leaderboard.ts` (spec aparte).
- `GameScreen` guarda una vez por partida al pasar a `gameover`, con sesión y score > 0. Un motor nuevo solo debe emitir bien `status`/`score`.
- Semillas: los juegos no jugables tienen 10 filas `is_seed = true`. Al activarlo, decidir en el spec: conservarlas (ranking no vacío, mezcla con partidas reales) o borrarlas con una migración (`delete from public.scores where game_id = '<id>' and is_seed`). Nota: las políticas RLS no permiten `DELETE` desde la API pública; la migración corre como admin.
- Las puntuaciones se identifican por nombre (sin Auth); limitación aceptada hasta el spec de Auth.

## 5. Assets

Binarios en `public/games/<id>/`, cargados dentro del motor (no en el render). No se copian archivos basura de `references/` (`.DS_Store`, `__MACOSX`, `.git*`, `.claude`, `.agents`, `specs/`, `skills-lock.json`).

## 6. Verificación estándar

- `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- `git grep -nE "^let |^var " -- lib/games` vacío; `lib/games/<id>/` sin imports de `react`/`next`.
- `git diff` vacío en `references/` y `lib/games/asteroids/`.
- `/juegos/<id>/jugar` muestra el juego; los demás ids no jugables siguen con el placeholder; `/juegos/inexistente/jugar` da 404.
- Jugar con sesión mock hasta GAME OVER: una fila en `scores` (`execute_sql` del MCP de Supabase), barra `GUARDADO #N`, la fila aparece en `/juegos/<id>` y `/salon` sin reiniciar el servidor.
- Sin sesión: «INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN» y no se inserta nada.
- Consola sin errores ni avisos de hidratación (Playwright MCP).
- `get_advisors` (security) sin avisos nuevos si hubo migración.

## 7. Documentación

Si el cambio altera el patrón (canvas parametrizable, nuevo tipo en `lib/games/types.ts`), actualizar el punto de *Architecture notes* de `CLAUDE.md` sobre `lib/games/` y `GameScreen`. `git diff` de `CLAUDE.md` debe mostrar solo eso.
