# SPEC 14 — Endurecer la autenticación y la base de datos (hallazgos SEC-02, 03, 04, 05, 06 y 08)

> **Status:** implemented
> **Depends on:** SPEC 04, SPEC 06, SPEC 12, SPEC 13
> **Date:** 2026-11-13
> **Objective:** Cerrar los hallazgos de la auditoría de `security-findings.md` que afectan al código de autenticación y al esquema de Supabase: open redirect en `safeNext`, unicidad del username en la BD, origen fijo de los enlaces de auth, integridad de `scores`, grants mínimos y migraciones versionadas.

---

## Por qué existe este spec

La auditoría del 2026-11-13 (agente `security-auditor`) encontró que varias garantías de los SPEC 12 y 13 solo se cumplen cuando se usa la interfaz de la app y se saltan llamando directamente a la API de Supabase o con una URL manipulada: `safeNext` deja pasar `/<TAB>/evil.com`, la regla de usernames vive solo en una Server Action, y `scores_insert_own` no limita `game_id` ni `created_at`. Este spec mueve esas reglas a donde no se pueden esquivar (la BD y una función pura de validación). Es el primero de dos: el SPEC 15 cubre las cabeceras HTTP y el límite del formulario de contacto.

## Scope

**In:**

- **SEC-02 · `safeNext`** (`lib/auth.ts`): rechazar cualquier ruta con caracteres de control (`< 0x20` o `0x7f`) y resolverla con `new URL(next, "http://x")`; aceptarla solo si el origen resultante sigue siendo `http://x`, y devolver `pathname + search + hash`. Mantiene el fallback `/biblioteca`.
- **SEC-03 · Unicidad del username en la BD:** trigger `BEFORE INSERT` en `public.profiles` que rechaza un `username` cuyo `lower()` aparece en `scores.player_name` de filas que no son del propio usuario (`user_id is null or user_id <> new.id`). Cubre `auth.signUp` directo (vía `handle_new_user`) y el `insert` directo en `profiles`. La comprobación de `app/auth/actions.ts` se mantiene como validación temprana.
- **SEC-04 · Origen fijo:** nueva variable `SITE_URL` (solo servidor). `getOrigin()` de `app/auth/actions.ts` y la base de redirección de `app/auth/callback/route.ts` la usan en producción. En desarrollo (`NODE_ENV !== "production"`) sin variable se usa el `Host` de la petición, para no romper `localhost` con cualquier puerto ni las pruebas por LAN. En producción sin la variable, la acción responde `failed` y el callback redirige a `/auth?error=callback`, ambos con `console.error`.
- **SEC-05 · Integridad de `scores`:**
  - Columna `games.playable boolean not null default false`, `true` para `asteroids`, `tetris`, `arkanoid` y `serpentina`.
  - `scores_insert_own` exige además que el `game_id` sea de un juego con `playable = true`.
  - Grants de columna: `authenticated` solo puede insertar `game_id`, `player_name`, `score` y `user_id` (`id` y `created_at` los fija la BD).
  - Trigger `BEFORE INSERT` en `scores` que rechaza más de 10 marcas por `user_id` en los últimos 60 segundos.
- **SEC-06 · Grants mínimos:** quitar a `anon` y `authenticated` todos los privilegios sobre `games`, `scores`, `profiles` y `game_stats` y volver a conceder solo lo que usa la app (ver «Data model»).
- **SEC-08 · Versionar `rls_auto_enable()` y `ensure_rls`:** migración idempotente nueva (`create or replace function` y creación del event trigger solo si falta) con la definición real inspeccionada en el SPEC 13. No se renombran los archivos locales existentes.
- **Documentación:** `CLAUDE.md` (variable `SITE_URL`, `games.playable`, grants, trigger de usernames y límite de frecuencia), `.env.example`, la integración de `/add-game` (`.claude/skills/add-game/references/integration.md`: un juego nuevo debe marcarse `playable = true` en su migración) y `security-findings.md` (mover SEC-02, 03, 04, 05, 06 y 08 a «Corregidos» tras verificarlos).

**Out of scope (for future specs):**

- SEC-01 (fusionar `chore/next-security-upgrade`, Next 16.4.6): tarea manual con su propia rama.
- SEC-07 (borrar `public/node_modules/`) y SEC-10 (parar los servidores de los puertos 3100 y 3101): limpiezas manuales.
- SEC-09 y SEC-11 (formulario de contacto y cabeceras): SPEC 15.
- Tope de score por juego (descartado, ver «Decisions»), rate limiting en login o registro (lo gestiona Supabase Auth) y verificar la lista de Redirect URLs del panel de Supabase (la revisa el usuario a mano).
- Renombrar los archivos de `supabase/migrations/` para alinear sus prefijos con las versiones remotas.
- Mover el cálculo de `PLAYABLE_GAME_IDS` a una consulta a `games.playable` en el código (la constante de `lib/games.ts` se mantiene).

## Data model

```ts
// lib/auth.ts — misma firma, nueva validación
export function safeNext(next: string | null | undefined, fallback = "/biblioteca"): string;
// "/perfil?x=1#a"   -> "/perfil?x=1#a"
// "/\t/evil.com"    -> "/biblioteca"
// "//evil.com", "https://evil.com", "/\\evil.com" -> "/biblioteca"
```

```sql
-- SEC-05: catálogo
alter table public.games add column playable boolean not null default false;
update public.games set playable = true where id in ('asteroids', 'tetris', 'arkanoid', 'serpentina');

-- SEC-05: la política añade la condición de juego jugable (el resto de condiciones no cambia)
--   exists (select 1 from public.games g where g.id = scores.game_id and g.playable)

-- SEC-06 / SEC-05: grants resultantes
revoke all on public.games, public.scores, public.profiles, public.game_stats from anon, authenticated;
grant select on public.games, public.scores, public.game_stats to anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, username) on public.profiles to authenticated;   -- ajustar a las columnas reales
grant insert (game_id, player_name, score, user_id) on public.scores to authenticated;

-- SEC-03
-- trigger profiles_check_username_history (BEFORE INSERT on public.profiles):
--   raise exception 'username_taken' using errcode = '23505'
--   if exists (select 1 from public.scores s
--              where lower(s.player_name) = lower(new.username)
--                and (s.user_id is null or s.user_id <> new.id));

-- SEC-05: trigger scores_rate_limit (BEFORE INSERT on public.scores):
--   raise exception 'rate_limited' using errcode = 'P0001'
--   if (select count(*) from public.scores
--       where user_id = new.user_id and created_at > now() - interval '60 seconds') >= 10;
```

```
# .env.example — variable nueva
# URL pública del sitio (sin barra final). Obligatoria en producción: se usa en los enlaces
# de los correos de Supabase y en el retorno de Google. En desarrollo es opcional.
SITE_URL=
```

Convenciones:

- Los nombres de las funciones y triggers de los bloques SQL son definitivos; las columnas de los `grant insert (...)` se confirman con `list_tables` antes de aplicar la migración (si `profiles` tiene columnas con valor por defecto, no se conceden).
- Las funciones de los triggers son `SECURITY DEFINER` solo si necesitan leer `scores` o `games` con RLS; en ese caso fijan `search_path = ''` y usan nombres calificados con `public.`, como `is_username_available`.
- Cada migración se aplica con `apply_migration` y se guarda en `supabase/migrations/` con prefijo de fecha mayor que `20261110130000`. Después se regeneran los tipos con `generate_typescript_types` (`lib/supabase/database.types.ts`).

## Implementation plan

Cada paso deja la app funcionando y se puede commitear solo.

1. **SEC-02.** Reescribir `safeNext` en `lib/auth.ts`. Verificar con un script de Node de una línea sobre los casos de «Data model» más `%0A`, `%0D`, `//evil.com`, `https://evil.com` y `/\evil.com`.
2. **SEC-04.** Añadir `SITE_URL` a `.env.example`, leerla en `getOrigin()` y en `app/auth/callback/route.ts` (quitando el uso de `x-forwarded-host`). Verificar con `SITE_URL` definida (los enlaces salen con ese origen aunque se envíe un `Host` falso con `curl`) y sin definir en desarrollo.
3. **SEC-03.** Migración con la función y el trigger de `profiles`. Verificar con `execute_sql` en una transacción con rollback: insertar un perfil con un nombre presente en `scores` de filas sin dueño falla, y uno libre pasa.
4. **SEC-05 (catálogo y política).** Migración con `games.playable` y la política `scores_insert_own` actualizada. Verificar: insertar como `authenticated` una marca de `gloton` falla y una de `tetris` pasa.
5. **SEC-05 (frecuencia).** Migración con el trigger `scores_rate_limit`. Verificar: la marca 11 en 60 segundos del mismo usuario falla; una partida normal guarda sin problema.
6. **SEC-06 y SEC-05 (grants).** Migración con los `revoke`/`grant`. Verificar con `role_table_grants` y probando `saveScore`, el registro, `/perfil`, `/salon` y `/biblioteca` con sesión y sin ella.
7. **SEC-08.** Migración idempotente de `rls_auto_enable()` y `ensure_rls`. Verificar que `get_advisors` (security) sigue sin avisos de esa función y que `pg_event_trigger` conserva `ensure_rls` habilitado.
8. **Tipos y documentación.** Regenerar `lib/supabase/database.types.ts`, actualizar `CLAUDE.md`, `.env.example`, `.claude/skills/add-game/references/integration.md` y `security-findings.md`, y correr `npm run lint` y `npm run build`.

## Acceptance criteria

- [x] `safeNext("/\t/evil.com")`, `safeNext("/\n/evil.com")` y `safeNext("/\r/evil.com")` devuelven `/biblioteca`; `//evil.com`, `https://evil.com` y `/\evil.com` también.
- [x] `safeNext("/perfil?x=1#a")` devuelve `/perfil?x=1#a`.
- [x] Con sesión iniciada, abrir `/auth?next=%2F%09%2Fevil.com` redirige a `/biblioteca` (no a `evil.com`).
- [x] Con `SITE_URL` definida, el `redirectTo` que envía `requestPasswordReset` usa ese origen aunque la petición lleve otro `Host` o `X-Forwarded-Host`.
- [x] En producción sin `SITE_URL`, `requestPasswordReset` responde `failed` y `/auth/callback` redirige a `/auth?error=callback`, sin redirigir a ningún `Host` de la petición.
- [x] Insertar un perfil con un `username` que existe en `scores.player_name` de filas ajenas falla (también con `auth.signUp` directo con la clave publishable), y un nombre libre se registra con normalidad.
- [x] Un usuario con marcas propias (`scores.user_id` igual a su `id`) no queda bloqueado por el trigger de `profiles`.
- [x] Insertar como `authenticated` una marca con `game_id` de un juego con `playable = false` falla; con `asteroids`, `tetris`, `arkanoid` o `serpentina` pasa.
- [x] Un `insert` de `authenticated` que incluya `created_at` o `id` en `scores` falla por permisos de columna.
- [x] La marca número 11 de un mismo `user_id` en 60 segundos falla con `rate_limited`; jugar y guardar una partida normal sigue funcionando en los 4 juegos.
- [x] `role_table_grants` muestra que `anon` solo tiene `SELECT` sobre `games`, `scores` y `game_stats`, y que `authenticated` no tiene `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` ni `TRIGGER` en ninguna de las 4 relaciones.
- [x] Registro, login, `/perfil`, `/salon`, `/biblioteca` y `/juegos/[id]` siguen funcionando con y sin sesión tras cambiar los grants.
- [x] `supabase/migrations/` contiene la definición de `rls_auto_enable()` y de `ensure_rls`, y `get_advisors` (security) reporta como máximo los 3 avisos ya aceptados.
- [x] `lib/supabase/database.types.ts` incluye `games.playable`.
- [x] `CLAUDE.md`, `.env.example` y `security-findings.md` reflejan los cambios, con SEC-02, 03, 04, 05, 06 y 08 en «Corregidos».
- [x] `npm run lint` y `npm run build` pasan sin errores.

## Decisions taken and discarded

- **Yes:** dividir la auditoría en dos specs (14: auth y BD; 15: cabeceras y contacto), por decisión del usuario. Cada uno se verifica por separado.
- **Yes:** `SITE_URL` como variable de entorno (decisión del usuario). Sustituye la decisión del SPEC 12 de no usar una variable de sitio. **No:** lista blanca de orígenes en código, porque exige editar código por cada dominio.
- **Yes:** en desarrollo, sin `SITE_URL`, se usa el `Host` de la petición. Obligar a definirla en local rompería los puertos variables y las pruebas por LAN (`ALLOWED_DEV_ORIGINS`).
- **Yes:** `games.playable` como columna (decisión del usuario). Un juego nuevo se activa con su migración. **No:** lista fija en la política, que obligaría a reescribirla con cada juego.
- **Yes:** grants de columna, solo juegos jugables y límite de frecuencia de 10 marcas por minuto y usuario (decisión del usuario). El valor 10 es holgado: terminar una partida de cualquier juego lleva bastante más de 6 segundos.
- **No:** tope de score por juego. Exige fijar un máximo para cada juego y deja de servir si alguien lo supera legítimamente; la barrera real contra marcas falsas sería validar la partida en servidor, que es otro problema (ver «What is not in this spec»).
- **Yes:** migración idempotente para SEC-08 (decisión del usuario), sin tocar las versiones ya aplicadas. **No:** renombrar archivos locales, porque reescribe el historial para un beneficio pequeño.
- **Yes:** mantener la comprobación de username de la Server Action como validación temprana y poner el trigger como barrera. Sin la primera, el usuario vería un error genérico de la BD en lugar de «nombre ya en uso».
- **Yes:** `safeNext` valida resolviendo la URL, no con una lista de caracteres prohibidos. Una lista se queda corta ante el próximo carácter que `new URL()` normalice.

## Identified risks

| Riesgo                                                                                               | Mitigación                                                                                                                       |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Recortar grants rompe una consulta que dependía de un privilegio no previsto                         | Aplicar el paso 6 solo tras listar los accesos de la app; probar todas las rutas con y sin sesión; revertir con `grant` si falla |
| `SITE_URL` mal escrita (barra final, `http` en vez de `https`) deja los enlaces de correo rotos      | Normalizar quitando la barra final y documentar el formato en `.env.example`; probar el flujo de recuperación en producción      |
| `SITE_URL` no definida en el despliegue y el registro/recuperación quedan inutilizables              | Error explícito en el log; el criterio de aceptación comprueba el comportamiento sin variable                                    |
| El trigger de usernames bloquea nombres legítimos que coinciden con marcas antiguas (22 nombres hoy) | Es el comportamiento buscado (SPEC 12); el mensaje `username_taken` ya existe en la interfaz                                     |
| `playable` y `PLAYABLE_GAME_IDS` se desincronizan al añadir un juego                                 | Documentarlo en `integration.md` de `/add-game` y en `CLAUDE.md`                                                                 |
| El límite de 10 marcas por minuto bloquea una ráfaga legítima (p. ej. reintentos de `REINTENTAR`)    | `saveScore` ya guarda una vez por partida; si hace falta, subir el umbral en una migración                                       |

## What is **not** in this spec

- Fusionar la actualización de Next.js, borrar `public/node_modules/` y parar servidores viejos (SEC-01, 07, 10).
- Cabeceras HSTS y Permissions-Policy, `X-Powered-By` y el límite de frecuencia del formulario de contacto (SPEC 15).
- CSP, protección de contraseñas filtradas y validación de partidas en servidor (anti-trampas).
- Renombrar los archivos de migración existentes.

Cada uno de esos puntos, si llega, va en su propio spec.

## Estado de la verificación (2026-11-14)

Aplicado en la BD de desarrollo (migraciones `20261114120000`–`120400`), con tipos regenerados, `npm run lint` (0 errores) y `npm run build` correctos. Todos los criterios cumplidos:

- **`safeNext`:** 12 casos con Node; en vivo con sesión, `/auth?next=%2F%09%2F127.0.0.1:9` terminó en `/biblioteca` y `/auth?next=%2Fperfil` en `/perfil`.
- **`SITE_URL`:** en producción (`next start`) sin la variable, el callback responde 307 relativo a `/auth?error=callback` y `requestPasswordReset` muestra el error y registra `SITE_URL no está definida`; con la variable, el callback redirige a su origen aunque el `Host` y `X-Forwarded-Host` sean falsos y `requestPasswordReset` pasa la fase de origen (Supabase solo rechazó el dominio `example.com` de prueba; con un dominio válido responde «Solicitud registrada»). El valor exacto de `redirectTo` no se observó directamente: sale de la misma `getOrigin()` que el callback.
- **Usernames:** `auth.signUp` directo con `NEONFOX` (nombre de `scores`) devuelve `username_taken` (HTTP 500, sin usuario creado); el trigger deja pasar un nombre libre y al dueño de sus marcas (probado con `insert` bajo rollback). El alta de un nombre libre por la interfaz no se ejecutó, porque enviaría un correo real de confirmación.
- **Marcas:** con sesión real se guardaron 8 partidas de Tetris vía `saveScore` (con `user_id`, sin semilla); como `authenticated`, `asteroids`, `tetris`, `arkanoid` y `serpentina` pasan y `gloton`, `invasores`, `ranaria` y `duelo-pixel` dan 42501; `created_at`/`id` dan 42501; la marca 11 en 60 s da `rate_limited` (también se observó al sumar las marcas reales a las de prueba). Solo Tetris se jugó de verdad; en los otros tres juegos se probó la inserción, no la partida.
- **Grants y avisos:** `anon` solo `SELECT` en `games`, `scores`, `game_stats`; `get_advisors` solo muestra los 3 avisos aceptados; `/biblioteca`, `/salon`, `/juegos/*`, `/acerca-de`, `/auth` y `/perfil` responden como antes.

El usuario de prueba y sus marcas se borraron; la BD de desarrollo quedó en 89 marcas, 2 perfiles y 2 usuarios.
