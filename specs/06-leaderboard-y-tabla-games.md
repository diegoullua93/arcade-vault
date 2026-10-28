# SPEC 06 — Tabla de juegos y leaderboard real en Supabase

> **Status:** approved
> **Depends on:** SPEC 01, SPEC 04, SPEC 05
> **Date:** 2026-10-28
> **Objective:** Crear en Supabase las tablas `games` y `scores`, leer el catálogo y los rankings desde ellas en lugar de `GAMES` y `seededScores`, y guardar la puntuación de Asteroids al terminar la partida.

---

## Por qué existe este spec

El SPEC 04 conectó la app con Supabase dejando `public` vacío, y el SPEC 05 dejó Asteroids jugable pero sin guardar nada. Hoy el catálogo vive en `lib/games.ts` (`GAMES`) y todo ranking sale de `seededScores` (`lib/scores.ts`), un generador determinista que alimenta `/salon`, el TOP 10 de `/juegos/[id]` y las cifras `best` / `plays`.

Este spec es el primero con esquema: lo que se decida aquí (RLS, migraciones, tipos) lo heredan los siguientes. Es grande (esquema, catálogo, rankings y guardado). `/spec` recomendó dividirlo en dos; **el usuario decidió mantenerlo en uno solo**, así que el plan está ordenado para que cada paso deje la app funcionando y se pueda commitear por separado.

La app sigue sin Auth real (`SessionProvider` guarda `{ name }` en `localStorage`, clave `av_user`). Por eso las puntuaciones se identifican por **nombre de jugador**, no por usuario, y el insert es público. Es una limitación consciente, descrita en Risks.

## Scope

**In:**

- Migraciones SQL versionadas en `supabase/migrations/`, aplicadas con `apply_migration` (decisión del SPEC 04).
- Tabla `games` con los 8 juegos actuales, RLS activa y lectura pública.
- Tabla `scores` con RLS activa, lectura pública e insert público con validaciones (`CHECK`), sin `UPDATE` ni `DELETE`.
- Filas semilla en `scores` para los 7 juegos **no jugables** (10 por juego, `is_seed = true`), copiadas una vez de la salida de `seededScores`. Asteroids empieza sin filas.
- Vista `game_stats` (`best` = máximo, `plays` = recuento por juego) y funciones SQL `get_leaderboard` y `get_player_best`.
- Tipos generados en `lib/supabase/database.types.ts` y `createClient<Database>()` en `lib/supabase/client.ts` y `lib/supabase/server.ts`.
- Capa de lectura en `lib/queries/`: catálogo cacheado con `use cache`, estadísticas y rankings dinámicos.
- Cliente de Supabase sin cookies (`lib/supabase/anon.ts`) para leer dentro de `use cache`, que no admite `cookies()`.
- Páginas que pasan a leer de Supabase: `/biblioteca`, home (sección de juegos y contador de juegos), `/juegos/[id]`, `/juegos/[id]/jugar` y `/salon`.
- `best` y `plays` derivados de `scores`; `plays` formateado (`987`, `12.4K`) y `best` sin partidas mostrado como `—`.
- Estados vacíos del ranking (0, 1 o 2 filas) en `/salon` y en el TOP 10 del detalle.
- «Tu mejor marca» en `/salon` real: rango y puntuación del nombre de la sesión mock, consultados a `get_player_best`.
- Server Action `saveScore` (`app/juegos/[id]/jugar/actions.ts`) y `lib/leaderboard.ts` con tipos y límites, siguiendo el patrón de `lib/contact.ts` + `app/acerca-de/actions.ts`.
- Guardado automático al llegar a `gameover` en `GameScreen`, solo con sesión; estados `GUARDANDO` / `GUARDADO #rango` / `ERROR` con `REINTENTAR` en la barra inferior del marco CRT (React, sin tocar el canvas ni el motor).
- Sin sesión, el mensaje «INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN» con enlace a `/auth`.
- Diseño de los estados nuevos con `/frontend-design`, como exige `CLAUDE.md`.
- Actualizar `CLAUDE.md` (Architecture notes) y retirar de `lib/games.ts` y `lib/scores.ts` lo que quede sin uso.

**Out of scope (para specs futuros):**

- Supabase Auth en cualquier forma y columna `user_id`. El mock `SessionProvider` y `AuthForm` no se tocan.
- Evitar suplantación o trampas: cualquiera con la publishable key puede insertar con cualquier nombre. Validación de partida en servidor, rate limit y captcha van en otro spec.
- `service_role` / secret key y cualquier cliente con privilegios.
- Paginación, ranking por periodo (semanal, mensual), filtros y búsqueda en el ranking.
- Actualización en tiempo real (Realtime) del ranking.
- Guardar puntuaciones de otros juegos: solo Asteroids tiene motor.
- Panel de administración para editar el catálogo.
- Borrar las filas semilla; `is_seed` deja esa puerta abierta.
- Mover a la base de datos las clases de portada (`cover-*`) o los colores; siguen siendo CSS en `app/globals.css`.
- Actividad reciente del home (`lib/home.ts`) y el resto de cifras de `StatsSection`: siguen siendo mock.
- Récord personal en `localStorage`.
- Guardar mensajes de contacto.
- Tests automatizados: el repo no tiene test runner.
- Modificar `references/`.

## Data model

Dos tablas, una vista y dos funciones en `public`. RLS se activa en la misma migración que crea cada tabla.

```sql
create table public.games (
  id         text primary key,                 -- 'asteroids', 'bloque-buster', ...
  title      text not null,
  short      text not null,
  long       text not null,
  category   text not null check (category in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover      text not null,                    -- clase CSS, p. ej. 'cover-asteroids'
  color      text not null check (color in ('cyan','magenta','yellow','green')),
  sort_order integer not null unique           -- orden actual de GAMES (1..8)
);

create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null references public.games(id),
  player_name text not null check (char_length(player_name) between 1 and 20),
  score       integer not null check (score between 1 and 9999999),
  is_seed     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc);
```

Políticas RLS:

| Tabla    | Operación           | Roles                   | Regla                          |
| -------- | ------------------- | ----------------------- | ------------------------------ |
| `games`  | `SELECT`            | `anon`, `authenticated` | `true`                         |
| `games`  | escritura           | —                       | sin política (denegada)        |
| `scores` | `SELECT`            | `anon`, `authenticated` | `true`                         |
| `scores` | `INSERT`            | `anon`, `authenticated` | `with check (is_seed = false)` |
| `scores` | `UPDATE` / `DELETE` | —                       | sin política (denegadas)       |

Vista y funciones (todas `security invoker`, con `search_path` fijo; la vista con `security_invoker = true`):

```sql
-- una fila por juego con partidas
create view public.game_stats with (security_invoker = true) as
  select game_id, max(score) as best, count(*) as plays
  from public.scores group by game_id;

-- mejor marca por nombre (sin distinguir mayúsculas); desempate: la más antigua
-- devuelve: rank, player_name, score, created_at
public.get_leaderboard(p_game_id text, p_limit integer default 10)

-- mejor marca y rango de un nombre en un juego; sin filas si no ha jugado
-- devuelve: rank, score, created_at
public.get_player_best(p_game_id text, p_player_name text)
```

Tipos en TypeScript:

```ts
// lib/games.ts  (Game pierde best/plays; se añade GameWithStats)
export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory; // columna `category`
  cover: string;
  color: GameColor;
};
export type GameWithStats = Game & { best: number; plays: number };
export function formatPlays(plays: number): string; // 987 -> "987", 12400 -> "12.4K"

// lib/leaderboard.ts  (patrón de lib/contact.ts)
export const SCORE_LIMITS = { name: 20, maxScore: 9_999_999 } as const;
export type LeaderboardRow = { rank: number; name: string; score: number; date: string }; // date "dd/mm/aaaa"
export type SaveScoreInput = { gameId: string; playerName: string; score: number };
export type SaveScoreResult =
  { ok: true; rank: number } | { ok: false; error: "invalid" | "save_failed" };

// lib/queries/games.ts
export async function getGames(): Promise<Game[]>; // "use cache", tag "games"
export async function getGame(id: string): Promise<Game | null>; // sobre getGames()
export async function getGamesWithStats(): Promise<GameWithStats[]>; // catálogo cacheado + game_stats dinámico

// lib/queries/scores.ts   (dinámico, sin caché)
export async function getLeaderboard(gameId: string, limit: number): Promise<LeaderboardRow[]>;
```

Convenciones:

- Los rankings y `game_stats` **no** se cachean; solo el catálogo (`games`) usa `use cache` con `cacheTag("games")` y `cacheLife` larga.
- `lib/supabase/anon.ts` exporta `createAnonClient()`, que usa `createClient` de `@supabase/supabase-js` sin cookies. Como en SPEC 04, se crea **dentro de cada función**, nunca como constante de módulo.
- Las fechas de `LeaderboardRow` se formatean en el servidor con zona fija (`UTC`) y `es-ES`, para evitar hydration mismatch en `HallOfFame` (Client Component).
- `saveScore` normaliza `playerName` (sin caracteres de control, `trim`), exige que `gameId` esté en `PLAYABLE_GAME_IDS` y que `score` sea entero entre 1 y `SCORE_LIMITS.maxScore`. Los límites se repiten en los `CHECK` de la tabla.
- Puntuación 0 no se guarda.
- `saveScore` llama a `revalidatePath` para `/salon` y `/juegos/{gameId}` tras insertar.
- Migraciones: `supabase/migrations/<timestamp>_create_games.sql` y `supabase/migrations/<timestamp>_create_scores.sql`.

## Implementation plan

Antes de empezar: leer en `node_modules/next/dist/docs/` lo relativo a `use cache`, `cacheLife`, `cacheTag`, `revalidatePath`, Server Actions y lectura de datos bajo `<Suspense>` con `cacheComponents` (ver `CLAUDE.md`). Con `search_docs` del MCP de Supabase, confirmar la sintaxis vigente de vistas con `security_invoker`, funciones con `search_path` y políticas por rol. Invocar `/frontend-design` antes del paso 9.

1. **Tabla `games`.** Crear `supabase/migrations/<timestamp>_create_games.sql` con la tabla, RLS, política `SELECT` y el seed de los 8 juegos (copiado de `GAMES`, `sort_order` 1..8). Aplicarla con `apply_migration`. Verificar: `list_tables` muestra `games` con RLS activa, `select count(*)` da 8 y `get_advisors` (security) no reporta RLS desactivada.
2. **Tabla `scores`, vista y funciones.** Generar una sola vez, con un script en el scratchpad (fuera del repo), las 70 filas semilla desde `seededScores` para los 7 juegos no jugables. Crear `supabase/migrations/<timestamp>_create_scores.sql` con la tabla, el índice, RLS, políticas, el seed (`is_seed = true`, fechas fijas), `game_stats`, `get_leaderboard` y `get_player_best`. Aplicarla. Verificar: 70 filas semilla, 0 de `asteroids`, `get_leaderboard('caida', 10)` devuelve 10 filas ordenadas y `get_advisors` sin avisos nuevos de seguridad.
3. **Tipos y clientes tipados.** Ejecutar `generate_typescript_types` y guardar `lib/supabase/database.types.ts`. Añadir `<Database>` a `createBrowserClient` y `createServerClient`. Verificar: `npx tsc --noEmit` pasa.
4. **Capa de lectura.** Crear `lib/supabase/anon.ts`, `lib/queries/games.ts`, `lib/queries/scores.ts`, `lib/leaderboard.ts`, y añadir `GameWithStats` y `formatPlays` a `lib/games.ts` **sin quitar** `GAMES` todavía. Verificar: `npx tsc --noEmit` y `npm run lint` pasan; `npm run build` pasa.
5. **Detalle y reproductor.** `app/juegos/[id]/page.tsx` y `app/juegos/[id]/jugar/page.tsx` leen el juego con `getGame`, las cifras con `getGamesWithStats` y el TOP 10 con `getLeaderboard(id, 10)` bajo `<Suspense>`. `generateStaticParams` usa `getGames()`. Estado vacío del TOP 10. Verificar: `/juegos/caida` muestra las 10 filas semilla, `/juegos/asteroids` muestra el estado vacío, `/juegos/inexistente` da 404 y `/juegos/caida/jugar` conserva «JUEGO PRÓXIMAMENTE».
6. **Salón de la Fama.** `app/salon/page.tsx` carga el catálogo y `getLeaderboard(id, 12)` de todos los juegos y los pasa por props a `HallOfFame`. Podio con 0, 1 o 2 filas, estado vacío y «tu mejor marca» real vía `get_player_best` con el cliente de navegador. Verificar: cambiar de pestaña muestra las filas de cada juego; `ASTEROIDS` muestra el estado vacío; con sesión mock aparece «TU MEJOR MARCA» solo si ese nombre tiene marca.
7. **Biblioteca y home.** `Library`, `GameCard`, `MiniCard`, `GamesSection` y el contador de juegos de `StatsSection` reciben los datos por props desde las páginas (`/biblioteca` y `/`) y usan `getGamesWithStats`. Quitar `GAMES` y el `getGame` síncrono de `lib/games.ts`, y los campos `best`/`plays` fijos; conservar `CATS`, `PLAYABLE_GAME_IDS` y los tipos. Quitar `seededScores` de `lib/scores.ts` si ya nadie lo usa. Verificar: `git grep -n "GAMES\b\|seededScores" -- app components lib` no devuelve resultados y `npm run build` pasa.
8. **Server Action.** Crear `app/juegos/[id]/jugar/actions.ts` con `saveScore`: validar, insertar en `scores`, consultar el rango con `get_player_best`, `revalidatePath`. Verificar: `npx tsc --noEmit` y `npm run lint` pasan.
9. **Guardado en `GameScreen`.** Detectar la transición a `status === "gameover"` en `onHudChange`, llamar a `saveScore` con el nombre de la sesión (si hay) y mostrar los estados en la barra inferior del marco. Una sola llamada por partida; `restart` la rearma. Aplicar `/frontend-design` a los estados. Verificar: jugar hasta GAME OVER con sesión mock crea una fila en `scores` y aparece en `/juegos/asteroids` y `/salon`.
10. **Documentar.** Añadir a `CLAUDE.md`, en Architecture notes, un punto con las tablas, `lib/queries/`, el cliente `anon.ts` para `use cache` y el flujo de `saveScore`; actualizar la frase «No tables or Auth yet» y la de «Scores are not persisted yet». Verificar: `git diff` de `CLAUDE.md` muestra solo esos cambios.

## Acceptance criteria

**Build**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] `git grep -n "GAMES\b\|seededScores" -- app components lib` no devuelve resultados.
- [ ] No se modifica ningún archivo de `references/` ni `lib/games/asteroids/`.
- [ ] `lib/supabase/anon.ts` no importa `next/headers` y no crea ningún cliente fuera de su función exportada.

**Base de datos**

- [ ] `list_tables` muestra `games` y `scores` con RLS activa.
- [ ] `select count(*) from games` devuelve 8.
- [ ] `select count(*) from scores where is_seed` devuelve 70, y `where game_id = 'asteroids'` devuelve 0 antes de jugar.
- [ ] `get_leaderboard('caida', 10)` devuelve 10 filas con puntuación descendente y un solo registro por nombre.
- [ ] `get_player_best('caida', 'xyz')` sin partidas de ese nombre no devuelve filas.
- [ ] `get_advisors` (security) no reporta tablas sin RLS ni funciones con `search_path` mutable para los objetos de este spec.
- [ ] Existen `supabase/migrations/*_create_games.sql` y `*_create_scores.sql`, y `list_migrations` las muestra aplicadas.
- [ ] Con un script puntual en el scratchpad (publishable key): `INSERT` válido en `scores` pasa; `INSERT` con `is_seed = true`, con `score = 10000000` y con `player_name` de 21 caracteres falla; `UPDATE` y `DELETE` sobre `scores` no afectan filas; `INSERT` en `games` falla.

**Datos en pantalla**

- [ ] `/juegos/caida` muestra TOP 10 con 10 filas y el recuento de partidas es `10`.
- [ ] `/juegos/asteroids` muestra un estado vacío en el TOP 10 y `—` como mejor puntuación mientras no haya partidas.
- [ ] `/salon` tiene una pestaña por juego (8); la de `ASTEROIDS` muestra el estado vacío y las demás muestran podio y 10 filas.
- [ ] Con 1 o 2 filas en un juego, el podio muestra los huecos restantes como vacantes y no lanza errores.
- [ ] `/biblioteca` y la sección de juegos del home muestran los 8 y 6 juegos respectivamente, con `best` y `plays` coherentes con `game_stats`.
- [ ] El contador «JUEGOS» de `StatsSection` muestra 8.
- [ ] `formatPlays(987)` es `"987"` y `formatPlays(12400)` es `"12.4K"`.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/salon`, `/biblioteca` ni `/juegos/caida`.

**Guardado**

- [ ] Con sesión mock, al llegar a GAME OVER con puntuación mayor que 0 se inserta exactamente una fila en `scores` con `game_id = 'asteroids'`, el nombre de la sesión y esa puntuación.
- [ ] La barra del marco muestra `GUARDANDO` y después `GUARDADO #N`, donde `N` coincide con el rango en `/salon`.
- [ ] Reiniciar con `Espacio` y volver a perder inserta una segunda fila; pausar, reanudar o redibujar no inserta filas extra.
- [ ] Una puntuación mayor que la anterior del mismo nombre sube su fila en el ranking; una menor no crea una segunda fila en el ranking (sí en `scores`).
- [ ] Con una puntuación de 0 no se llama a `saveScore` ni se inserta nada.
- [ ] Sin sesión, GAME OVER muestra «INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN» con enlace a `/auth` y no se inserta nada.
- [ ] Si `saveScore` falla (p. ej. Supabase inalcanzable), se muestra `ERROR` con `REINTENTAR`, el juego sigue operativo y `REINTENTAR` vuelve a intentar el guardado una vez por pulsación.
- [ ] `saveScore` con `gameId` no jugable (`caida`), con puntuación negativa o fraccionaria o con nombre vacío devuelve `{ ok: false, error: "invalid" }` y no inserta.
- [ ] La fila guardada aparece en `/juegos/asteroids` y en `/salon` sin reiniciar el servidor.

**Sin efectos colaterales**

- [ ] Las partidas siguen funcionando igual: Asteroids no cambia de reglas ni de HUD (`git diff` sin cambios en `lib/games/`).
- [ ] No existe ninguna clave secreta ni `service_role` en el repo (mismos `git grep` del SPEC 04 sin resultados).
- [ ] `git status` lista solo `supabase/`, `lib/supabase/`, `lib/queries/`, `lib/games.ts`, `lib/scores.ts`, `lib/leaderboard.ts`, `lib/home.ts` (solo el contador), `app/` (rutas de `biblioteca`, home, `salon`, `juegos/[id]` y `juegos/[id]/jugar`), `components/` afectados, `app/globals.css`, `CLAUDE.md` y este spec.

## Decisions

- **Sí:** un solo spec con esquema, catálogo, rankings y guardado. Decisión del usuario, contra la recomendación de dividir en dos. El plan en 10 pasos commiteables mitiga el tamaño.
- **Sí:** `games` como fuente del catálogo. Una sola fuente de verdad; evita mantener `GAMES` y una tabla en paralelo.
- **No:** tabla `games` solo como referencia de la FK. Dejaría dos fuentes de verdad.
- **Sí:** `best` y `plays` derivados de `scores` con la vista `game_stats`. Siempre coherentes con el ranking; el coste es que los juegos semilla pasan de «12.4K partidas» a `10` hasta que haya partidas reales.
- **No:** columnas fijas `best` / `plays` en `games`. Se desincronizan con la primera partida real.
- **Sí:** ranking por mejor marca por nombre (sin distinguir mayúsculas). Evita que un solo jugador llene el TOP 10; todas las partidas siguen en `scores`.
- **Sí:** insert anónimo con nombre libre y validaciones `CHECK`. Auth sigue siendo mock y la clave publishable no identifica a nadie; es falsificable y se acepta hasta el spec de Auth.
- **No:** esperar al spec de Auth o dejar `scores` solo de lectura. El usuario quiere un leaderboard alimentado por partidas reales ahora.
- **Sí:** `INSERT` con `is_seed = false` en la política. Un cliente no puede hacerse pasar por semilla.
- **Sí:** sin políticas de `UPDATE` / `DELETE`. Una puntuación guardada no se edita ni se borra desde la API pública.
- **Sí:** `saveScore` como Server Action con validación y `revalidatePath`. Mismo patrón que `sendContactMessage`; centraliza validación y errores. No es una barrera de seguridad: quien llame directo a la API de Supabase con la publishable key se salta la Server Action, y solo lo frenan los `CHECK` y las políticas.
- **No:** `service_role` para que solo el servidor escriba. Cerraría la API pública a inserts pero exige una clave privilegiada que el SPEC 04 dejó fuera; va con el spec de Auth.
- **Sí:** guardado automático en GAME OVER. Sin él el leaderboard se vacía; un botón añade un paso que casi nadie pulsaría.
- **Sí:** no guardar puntuaciones de invitados e invitar a iniciar sesión. Con ranking por nombre, todos los `INVITADO` se fusionarían en una sola fila.
- **Sí:** no guardar puntuación 0. No aporta al ranking y llena la tabla de ruido.
- **Sí:** feedback de guardado en React, en la barra inferior del CRT, con `REINTENTAR`. El motor y el canvas no cambian; un fallo no interrumpe el juego.
- **Sí:** semillas en `scores` con `is_seed = true` para los 7 juegos no jugables y Asteroids vacío. El salón no se ve pelado salvo donde el juego sí existe y la lista real parte de cero.
- **No:** semillas para Asteroids. Es el único juego real; su ranking debe reflejar solo partidas reales.
- **Sí:** catálogo con `use cache` + `cacheTag("games")` y `cacheLife` larga; rankings y estadísticas dinámicos bajo `<Suspense>`. El catálogo casi no cambia; el ranking cambia con cada partida.
- **No:** `use cache` en rankings. Se vería desfasado tras guardar, y `revalidatePath` más tags añade complejidad sin necesidad.
- **Sí:** cliente `anon.ts` sin cookies para el catálogo cacheado. `cookies()` no se puede usar dentro de `use cache`; sigue creándose por llamada, nunca global.
- **Sí:** la clase `cover-*` y el color siguen en CSS y se guardan como texto en `games`. Mover el arte a la base de datos no aporta nada hoy.
- **No:** columna `playable` en `games`. Que un juego sea jugable depende de que exista su motor en código; se mantiene `PLAYABLE_GAME_IDS`.
- **Sí:** «tu mejor marca» real con `get_player_best`, consultada desde el cliente de navegador con el nombre de la sesión mock, que el servidor no conoce.
- **Sí:** fechas formateadas en servidor con zona `UTC`. Evita diferencias servidor/cliente.
- **Sí:** tipos generados (`database.types.ts`) en este spec. El SPEC 04 los aplazó hasta el primer spec con tablas.
- **Sí:** validación manual más comprobaciones de SQL y `git grep`. Sin test runner en el repo.

## Risks

| Riesgo                                                                                                       | Mitigación                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cualquiera puede insertar puntuaciones falsas o suplantar un nombre usando la publishable key                | Aceptado hasta el spec de Auth. `CHECK` de rango y longitud, `is_seed = false` y sin `UPDATE`/`DELETE` acotan el daño; las filas falsas se pueden purgar con SQL desde el panel                          |
| Spam de inserts llena la tabla                                                                               | Aceptado en este spec; el rate limit va con Auth o con una Edge Function en otro spec                                                                                                                    |
| El spec es grande y toca muchas páginas a la vez                                                             | 10 pasos independientes, cada uno con su verificación; la capa de lectura (paso 4) se añade antes de migrar a los consumidores                                                                           |
| `use cache` con `cacheComponents` falla si se lee `cookies()` dentro                                         | El catálogo usa `createAnonClient()` sin cookies; el cliente de servidor con cookies solo se usa en lecturas dinámicas y en la Server Action                                                             |
| Hydration mismatch al mostrar fechas o datos que dependen de la sesión mock                                  | Fechas formateadas en servidor con zona fija; lo que depende de `av_user` (`TU MEJOR MARCA`) se carga tras montar, como hace `SessionProvider`                                                           |
| `generateStaticParams` consulta Supabase en build y falla si no hay `.env.local`                             | Si faltan variables, el error nombra la variable (SPEC 04); documentar que el build necesita `NEXT_PUBLIC_SUPABASE_*`. El SPEC 04 exigía lo contrario porque no leía datos: aquí es un cambio consciente |
| Una vista sin `security_invoker` ignoraría RLS                                                               | `game_stats` se crea con `security_invoker = true` y `get_advisors` lo comprueba en el paso 2                                                                                                            |
| Doble guardado por el doble efecto de React 19 en desarrollo o por cambios de estado repetidos en `gameover` | Una sola llamada por transición a `gameover` (comparar contra el estado previo); criterio de aceptación sobre filas insertadas                                                                           |
| Pérdida silenciosa de la puntuación si falla la red                                                          | Estado `ERROR` con `REINTENTAR`; la puntuación sigue en el HUD durante el GAME OVER                                                                                                                      |
| Los datos semilla distorsionan estadísticas (`plays = 10` en vez de «12.4K»)                                 | Aceptado; `is_seed` permite excluirlos o borrarlos después                                                                                                                                               |
| Cache del router muestra el ranking viejo tras jugar                                                         | `revalidatePath` en `saveScore` y lecturas dinámicas; criterio de aceptación sobre la fila visible sin reiniciar                                                                                         |

## What is **not** in this spec

- Supabase Auth, `user_id` ni vinculación real entre partida y usuario.
- Protección contra trampas, suplantación, spam o rate limit.
- `service_role` o cualquier clave privilegiada.
- Paginación, filtros, periodos o Realtime en el ranking.
- Guardado de puntuaciones de juegos distintos de Asteroids.
- Panel de administración del catálogo.
- Borrado de semillas y mover portadas o colores a la base de datos.
- Actividad reciente y demás cifras mock del home.
- Récord personal en `localStorage` y guardado de mensajes de contacto.
- Tests automatizados.
- Cambios a `references/` o a las reglas del juego.

Cada uno de estos puntos, si se aborda, va en su propio spec.
