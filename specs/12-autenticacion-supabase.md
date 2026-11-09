# SPEC 12 — Pantallas de acceso y autenticación con Supabase Auth

> **Status:** approved
> **Depends on:** SPEC 01, SPEC 04, SPEC 06 (y SPEC 05, 07, 08, 09 por `saveScore`)
> **Date:** 2026-11-09
> **Objective:** Sustituir la sesión simulada de `localStorage` por Supabase Auth real (correo + contraseña con confirmación por correo, y Google), con pantallas de acceso, recuperación de contraseña, elección de username y `/perfil`, de modo que las marcas del leaderboard solo las pueda guardar su dueño.

---

## Por qué existe este spec

Hoy `/auth` es un formulario de maqueta: `SessionProvider` guarda `{ name }` en `localStorage` (`av_user`) y cualquiera con la clave publishable puede insertar un `score` con cualquier nombre (SPEC 04/06 lo aceptaron «hasta el spec de Auth»; `supabase/server.ts` ya deja el comentario «el refresco de sesión llegará con el spec de Auth»). Este spec cierra esa deuda:

- La identidad pasa a ser `auth.users` (Supabase Auth) con cookies gestionadas por `@supabase/ssr`.
- El nombre público del jugador (`player_name` de los scores) es un **username único** guardado en `profiles`, no texto libre.
- Insertar un score exige sesión y que el nombre coincida con el username del dueño, por RLS.

El resto de la plataforma debe seguir igual: `useSession()` conserva su forma (`user`, `signOut`) para que `Nav`, `PlayerName`, `HallOfFame` y `GameScreen` casi no cambien.

## Scope

**In:**

- **Registro con correo + contraseña** con **confirmación de correo**: el formulario pide username, correo y contraseña; tras enviarlo muestra el estado «REVISA TU CORREO». El enlace del correo cae en `/auth/callback`.
- **Inicio de sesión con correo + contraseña** y **con Google** (OAuth, solo Google; el botón de GitHub se quita de la UI).
- **Recuperar contraseña**: `/auth/olvide` (pide el correo) y `/auth/restablecer` (fija la contraseña nueva tras llegar por el enlace del correo).
- **Elegir username** en `/auth/username` para quien entra por Google (o por cualquier vía) y no tiene fila en `profiles`.
- **`/perfil`** (ruta protegida): username, correo, mejor marca por juego jugable y botón CERRAR SESIÓN.
- **Sesión real en toda la app:** `SessionProvider` lee la sesión de Supabase (cliente de navegador + `onAuthStateChange`), expone `{ user: { name } | null, signOut }` y se elimina `localStorage av_user`. `Nav` muestra el username y un menú con `/perfil` y cerrar sesión.
- **Refresco de sesión y rutas protegidas** con `proxy.ts` (Next 16; verificar el nombre y la API exactos en `node_modules/next/dist/docs/` antes de escribirlo): refresca cookies, redirige `/perfil` sin sesión a `/auth?next=/perfil` y `/auth` con sesión a `/biblioteca`.
- **Invitado:** el botón JUGAR COMO INVITADO se mantiene (solo navega a `/biblioteca`, sin sesión). Un invitado juega pero no guarda: al terminar con score > 0 ve el enlace a `/auth` que ya existe.
- **Base de datos** (migraciones con `apply_migration` + tipos regenerados): tabla `profiles`, trigger de alta, función de disponibilidad de username, columna `scores.user_id` y RLS estricta de `scores` (insert solo del dueño).
- **`saveScore`** (`app/juegos/[id]/jugar/actions.ts`) pasa a usar la sesión del servidor: ya no recibe `playerName` del cliente; lo lee de `profiles`.
- **Validaciones** compartidas en `lib/auth.ts` (límites de username, correo y contraseña, igual que `lib/contact.ts` y `lib/leaderboard.ts`).
- **Pasos manuales** (los hace el usuario en los paneles, documentados en este spec): URLs de redirección, proveedor Google, SMTP propio y plantilla de correos.

**Out of scope (for future specs):**

- GitHub y otros proveedores OAuth, magic link, OTP, 2FA.
- Cambiar username, cambiar correo o contraseña desde `/perfil`, borrar la cuenta.
- Avatar, bio o cualquier dato de perfil además del username.
- Migrar o reclamar marcas antiguas (las filas existentes quedan con `user_id` null y siguen visibles).
- Roles, administración, moderación de nombres ofensivos.
- Guardado de marcas de invitados (se queda en solo jugar).
- Rate limiting propio (se confía en el de Supabase).
- Tests automáticos (no hay runner; se verifica en navegador).

## Data model

```sql
-- Perfil público mínimo, 1:1 con auth.users.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null check (username ~ '^[A-Z0-9_]{3,10}$'),
  created_at timestamptz not null default now()
);
create unique index profiles_username_key on public.profiles (lower(username));
alter table public.profiles enable row level security;

-- RLS: cada usuario solo ve y crea su propia fila; sin UPDATE ni DELETE (el username es inmutable).
create policy "profiles_select_own" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

-- Alta por correo: el registro manda el username en raw_user_meta_data y el trigger crea el perfil.
-- (Con confirmación de correo el usuario aún no tiene sesión, así que no puede insertar por RLS.)
-- security definer + set search_path = ''. Si el username choca, el trigger falla y el signUp devuelve error.

-- Disponibilidad: true si no existe en profiles NI en scores.player_name (sin distinguir mayúsculas),
-- para que un usuario nuevo no se «fusione» con marcas antiguas o semillas con el mismo nombre.
-- create function public.is_username_available(p_username text) returns boolean ... security definer, stable.

-- scores: se añade el dueño.
alter table public.scores add column user_id uuid references auth.users (id) on delete set null;
-- Se sustituye "scores_insert_public" por:
-- create policy "scores_insert_own" on public.scores for insert to authenticated
--   with check (
--     is_seed = false
--     and user_id = (select auth.uid())
--     and player_name = (select username from public.profiles where id = (select auth.uid()))
--   );
-- anon deja de poder insertar. SELECT público, sin UPDATE/DELETE: igual que hoy.
```

```ts
// lib/auth.ts — límites compartidos entre formularios y Server Actions
export const AUTH_LIMITS = {
  username: { min: 3, max: 10, pattern: /^[A-Z0-9_]+$/ }, // se normaliza a mayúsculas antes de validar
  email: { max: 254 },
  password: { min: 8, max: 72 },
};

// Sesión expuesta a la UI (misma forma que el mock, sin `login`)
type SessionUser = { name: string }; // name = profiles.username
type SessionContextValue = { user: SessionUser | null; signOut: () => void };
```

Convenciones:

- El username se guarda en mayúsculas (`px_kai` → `PX_KAI`), como el mock actual y los nombres del leaderboard; la unicidad no distingue mayúsculas.
- `get_leaderboard` y `get_player_best` no cambian: siguen agrupando por `lower(player_name)`.
- `game_stats` no cambia.
- No se introduce ninguna variable de entorno nueva: las URLs de redirección salen del origen de la petición.

## Implementation plan

Cada paso deja la app funcionando. Hasta el paso 8 el insert anónimo de `scores` sigue abierto, así que guardar marcas no se rompe a mitad del trabajo.

1. **Base de datos (aditiva).** Migración 1: `profiles` + índice único + RLS, trigger `handle_new_user` (lee `raw_user_meta_data->>'username'`), función `is_username_available`, columna `scores.user_id`. Aún no se toca la política de insert de `scores`. Regenerar `lib/supabase/database.types.ts`. Verificar: `get_advisors` (security) sin avisos nuevos y `tsc` limpio.
2. **Configuración y utilidades.** `lib/auth.ts` (límites y validadores, incluida la sanitización de `next`: solo rutas que empiezan por `/` y no por `//`) y `proxy.ts` mínimo que refresca la sesión. Verificar: `npm run build` pasa y las rutas públicas siguen funcionando.
3. **Server Actions** en `app/auth/actions.ts`: `signUp` (valida, comprueba `is_username_available`, llama `auth.signUp` con `options.data.username` y `emailRedirectTo`), `signIn`, `signInWithGoogle` (devuelve la URL del proveedor), `requestPasswordReset`, `updatePassword`, `createProfile` (para quien no tiene fila), `signOut`. Mensajes de error genéricos en credenciales inválidas (sin revelar si el correo existe).
4. **Route Handler `app/auth/callback/route.ts`:** intercambia el `code` por sesión (confirmación, recuperación y Google), respeta `next` saneado y manda a `/auth/username` si no hay perfil.
5. **Pantallas.** Rehacer `components/auth-form.tsx` y crear `app/auth/olvide`, `app/auth/restablecer`, `app/auth/username` y `app/perfil` usando las clases del tema existentes (`auth-card`, `field`, `btn`…). Usar `/frontend-design` para mantener el estilo y revisar 390×844. Estados: cargando (botón deshabilitado), error por campo, «REVISA TU CORREO», «ENLACE ENVIADO», «CONTRASEÑA ACTUALIZADA». Verificar: cada pantalla renderiza en escritorio y móvil con la sesión aún simulada.
6. **`SessionProvider` real.** Reescribirlo con el cliente de navegador (`getSession`/`onAuthStateChange` + lectura de `profiles` para el username), `user` es `null` en el servidor y durante la hidratación (igual que hoy). `signOut` llama a Supabase y refresca. Borrar la clave `av_user`. Actualizar `Nav` (menú con PERFIL y CERRAR SESIÓN) y quitar `login()` de los consumidores. Verificar: iniciar y cerrar sesión se refleja en `Nav`, `PlayerName` y «Tu mejor marca».
7. **Rutas protegidas en `proxy.ts`:** `/perfil` sin sesión → `/auth?next=/perfil`; `/auth` con sesión y perfil → `/biblioteca`; sesión sin perfil → `/auth/username` (salvo en esa ruta y en el cierre de sesión). Verificar los tres casos con y sin sesión.
8. **`saveScore` con sesión y cierre de RLS.** Cambiar la Server Action para leer el usuario del servidor, obtener el username de `profiles` e insertar `user_id`; `GameScreen` deja de enviar el nombre. Solo después, migración 2: eliminar `scores_insert_public` y crear `scores_insert_own`. Verificar: con sesión se guarda y aparece `GUARDADO #N`; sin sesión el insert directo con la clave publishable devuelve error de RLS.
9. **Documentación y pasos manuales.** Actualizar `CLAUDE.md` (Session, Supabase, Database, Saving scores) y `.env.example` si hiciera falta; dejar en este spec la lista de pasos manuales (ver «Configuración manual»). Limpiar usuarios de prueba creados durante la verificación.

### Configuración manual (la hace el usuario; el código no puede)

- Supabase → Authentication → URL Configuration: _Site URL_ de producción y _Redirect URLs_ `http://localhost:3000/auth/callback` (y la IP LAN usada con `ALLOWED_DEV_ORIGINS` si se prueba en el móvil, con puerto).
- Supabase → Authentication → Providers: Email con «Confirm email» activo; Google con _Client ID_ y _Secret_ de Google Cloud Console (URI de redirección autorizado: la URL de callback de Supabase).
- **SMTP propio** (p. ej. el Resend que ya se usa en el formulario de contacto): el SMTP de Supabase por defecto solo permite unos pocos correos por hora y solo a miembros del equipo.
- Plantillas de correo (confirmación y recuperación) en español, con `{{ .ConfirmationURL }}`.

## Acceptance criteria

- [ ] `profiles` existe con RLS activada, índice único por `lower(username)` y `check` de formato; `get_advisors` (security) no reporta avisos nuevos.
- [ ] `scores.user_id` existe; las filas existentes tienen `user_id` null y `/salon` y `/juegos/[id]` siguen mostrando las mismas marcas.
- [ ] Un registro con correo + contraseña muestra «REVISA TU CORREO» y no inicia sesión hasta abrir el enlace; el enlace lleva a `/auth/callback` y deja al usuario con sesión y su username en `Nav`.
- [ ] Registrar un username ya existente en `profiles` o presente en `scores.player_name` (en cualquier combinación de mayúsculas) falla con un mensaje claro y no crea usuario.
- [ ] Inicio de sesión con credenciales incorrectas muestra un error genérico (sin revelar si el correo existe).
- [ ] Iniciar sesión con Google funciona de punta a punta; un usuario nuevo de Google es llevado a `/auth/username`, elige su nombre y entra a la plataforma.
- [ ] `/auth/olvide` envía el correo, el enlace abre `/auth/restablecer` y tras fijar la nueva contraseña se puede iniciar sesión con ella y no con la anterior.
- [ ] `/perfil` sin sesión redirige a `/auth?next=/perfil` y, tras iniciar sesión, vuelve a `/perfil`; con sesión muestra username, correo y la mejor marca por juego jugable.
- [ ] `/auth` con sesión redirige a `/biblioteca`; un parámetro `next` externo (`//evil.com`, `https://…`) se ignora.
- [ ] CERRAR SESIÓN (menú de `Nav` y `/perfil`) elimina las cookies de sesión y `Nav` pasa a «Iniciar Sesión» sin recargar a mano.
- [ ] Con sesión, terminar una partida con score > 0 guarda la marca con el username del perfil y `user_id` del usuario, y muestra `GUARDADO #N`; el rank coincide con `get_player_best`.
- [ ] Con la clave publishable y sin sesión, `insert` en `scores` falla por RLS; con sesión, insertar con un `player_name` distinto del username o un `user_id` ajeno también falla.
- [ ] Un invitado (sin sesión) puede jugar los 4 juegos; al terminar con score > 0 ve el enlace a `/auth` y no se inserta nada.
- [ ] No queda ninguna referencia a `av_user` ni a `login(` del mock en el código.
- [ ] `localStorage` bloqueado no rompe nada (la sesión vive en cookies de Supabase).
- [ ] Las pantallas nuevas se ven y se usan en 390×844 y 360×640 sin scroll horizontal, y en escritorio.
- [ ] `npm run lint` y `npm run build` pasan sin errores; no hay errores de consola en las pantallas de acceso.

## Decisions taken and discarded

- **Supabase Auth con cookies (`@supabase/ssr`)** en lugar de mantener el mock: es el objetivo de SPEC 04. Los clientes de `lib/supabase/` ya existen; se mantiene la regla de crear un cliente por petición.
- **Username en `profiles` único** (descartados: `user_metadata`, que no garantiza unicidad ni sirve en RLS, y derivarlo del correo, que lo expone y colisiona). Inmutable en este spec para no dejar marcas con un nombre que ya no existe.
- **Username único también frente a `scores.player_name`:** `get_leaderboard` agrupa por nombre, así que un jugador nuevo llamado `NEONFOX` heredaría las semillas. Se prohíben nombres ya usados en scores.
- **Perfil creado por trigger para el registro por correo** (con confirmación el usuario no tiene sesión y RLS impediría el insert desde el cliente) y por insert con sesión (`createProfile`) para quien llega por Google.
- **RLS estricta en `scores` (`user_id` + nombre igual al username)** en lugar de solo añadir `user_id`: es la razón de existir de este spec. El coste es que los invitados no guardan marcas; se acepta porque se mantiene el modo invitado solo para jugar.
- **Insert abierto hasta el paso 8:** el cierre de RLS va después de cambiar `saveScore` para que ninguna fase deje el guardado roto.
- **Confirmación de correo activa** (decisión del usuario). Exige SMTP propio; está en los pasos manuales y en riesgos.
- **Solo Google como OAuth** (decisión del usuario); el botón de GitHub se elimina en vez de dejarlo muerto.
- **`SessionProvider` con cliente de navegador** y no con lectura de cookies en el layout: con `cacheComponents` leer `cookies()` en el layout obliga a envolverlo en `<Suspense>` y rompería el prerender de todas las páginas. La protección real de rutas está en `proxy.ts` y en RLS, no en el provider.
- **`proxy.ts`** (nombre de Next 16 para el antiguo `middleware.ts`) para refrescar el token y proteger rutas; confirmar la API en la documentación local antes de escribirlo.
- **No se leen datos sensibles de `profiles` en cliente:** la disponibilidad de username se consulta con una función `security definer` en lugar de abrir `select` público de la tabla.
- **`next` saneado** (solo rutas relativas) para evitar open redirect.

## Identified risks

| Riesgo                                                                                                  | Mitigación                                                                                                           |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| El SMTP por defecto de Supabase limita los correos y bloquea los registros reales con confirmación      | Pasos manuales: configurar SMTP propio antes de probar con usuarios reales                                           |
| No se pueden abrir enlaces de correo desde Playwright MCP                                               | En la verificación, confirmar el usuario de prueba con `execute_sql` (`email_confirmed_at`) y borrarlo al terminar   |
| El flujo de Google necesita credenciales y consentimiento que el agente no puede dar                    | Prueba manual del usuario; el resto de criterios se verifican sin Google                                             |
| Carrera de username entre la comprobación y el trigger                                                  | El trigger falla por el índice único y `signUp` devuelve error; la UI lo traduce al mismo mensaje de «nombre en uso» |
| Un usuario autenticado sin perfil (cerró la pestaña en `/auth/username`) queda en un limbo              | `proxy.ts` lo devuelve a `/auth/username` en cada visita; `saveScore` responde con error claro sin perfil            |
| `get_player_best` y «Tu mejor marca» usan el nombre de la sesión; si el perfil tarda en cargar parpadea | `user` es `null` hasta cargar el perfil (igual que hoy durante la hidratación)                                       |
| Usuarios que ya usaban el mock pierden su «sesión»                                                      | Aceptado: el mock no tenía datos reales; sus marcas siguen en `scores` como filas sin dueño                          |
| Cambios de Next 16 (`proxy`, `cacheComponents`) distintos a lo esperado                                 | Leer `node_modules/next/dist/docs/` antes de escribir `proxy.ts` y los Route Handlers                                |

## Preguntas abiertas

- ¿Qué proveedor SMTP se usa para los correos de Auth (el Resend del formulario de contacto u otro)?
- ¿El dominio de producción ya está definido para la _Site URL_ y las redirect URLs?
- ¿Se quiere reservar nombres (p. ej. `ADMIN`, `VAULT`) al validar el username? Hoy solo se valida formato y unicidad.
