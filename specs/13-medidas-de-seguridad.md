# SPEC 13 — Medidas de seguridad básicas (cabeceras HTTP y avisos del linter de Supabase)

> **Status:** approved
> **Depends on:** SPEC 04, SPEC 12
> **Date:** 2026-11-10
> **Objective:** Aplicar el checklist de `references/security/security-checklist.md`: añadir las 3 cabeceras de seguridad a Next.js y resolver (o documentar como intencionales) los avisos de seguridad del linter de Supabase, salvo la protección de contraseñas filtradas.

---

## Por qué existe este spec

El checklist trae dos bloques: cabeceras para Next.js y una salida de `get_advisors` (security) con 5 avisos WARN. Las cabeceras no existen hoy en `next.config.ts`. De los avisos, dos son sobre `is_username_available` (intencional desde el SPEC 12), dos sobre `rls_auto_enable` (función que no está en `supabase/migrations/`, así que su origen es desconocido y un cambio en el panel no queda versionado) y uno sobre contraseñas filtradas.

## Scope

**In:**

- **Cabeceras de seguridad** en `next.config.ts` mediante `headers()`, para todas las rutas (`source: '/(.*)'`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin`. Antes de escribir el código, leer la guía de `headers` en `node_modules/next/dist/docs/` (Next 16 con `cacheComponents`).
- **`public.rls_auto_enable()`**: inspeccionar su definición con `execute_sql` (qué hace, si es la función de un event trigger, quién la usa) y revocar `EXECUTE` a `PUBLIC`, `anon` y `authenticated` en una migración nueva en `supabase/migrations/`, de modo que el cambio quede versionado. Cierra los avisos 0028 y 0029 de esta función.
- **`public.is_username_available(p_username text)`**: se mantiene `SECURITY DEFINER` y ejecutable por `anon` y `authenticated` (decisión del SPEC 12: se usa antes del registro y en `/auth/username`). Se comprueba que fija `search_path = ''` (si no lo fija, la migración lo corrige con `alter function`) y que solo devuelve `boolean`. La excepción queda documentada en este spec y en `CLAUDE.md`.
- **Verificación** de las cabeceras con la app en producción local (`npm run build` + `npm run start`) y de los avisos con `get_advisors` (security).
- **Página 404 propia** (`app/not-found.tsx`, ampliación pedida por el usuario el 2026-11-10): cualquier ruta inexistente muestra «404 · ESTA PÁGINA NO EXISTE» con `Nav`/`Footer` y botones al inicio y a la biblioteca, reutilizando las clases del tema (`av-hero`, `btn`). Devuelve estado 404, no redirige.
- **Alias `/login`** → `/auth` (`redirects` en `next.config.ts`, temporal). Con sesión, `/auth` ya redirige según `proxy.ts`.
- **Documentación** en `CLAUDE.md` (Next.js/seguridad y Database): cabeceras activas, la página 404, el alias y los avisos que se aceptan a propósito.

**Out of scope (for future specs):**

- `Strict-Transport-Security`, `Permissions-Policy` y `Content-Security-Policy` (se decidió aplicar solo las 3 cabeceras del checklist; CSP con nonce exige verificar `cacheComponents`, `next/font`, el canvas de los juegos, Supabase y Google).
- **«Leaked Password Protection»** (`auth_leaked_password_protection`): se deja fuera por decisión del usuario; el aviso WARN sigue abierto. Depende de un ajuste del panel de Supabase (suele requerir plan Pro) o de una comprobación propia contra HaveIBeenPwned.
- Mover `is_username_available` a un schema no expuesto (exigiría una clave de servicio, que el proyecto no usa).
- Rate limiting propio, 2FA, auditoría de dependencias y cualquier otro punto no presente en el checklist.
- Tests automáticos (no hay runner; se verifica en navegador y con el linter).

## Data model

Este spec no introduce estructuras de datos nuevas. Solo cambia la configuración de Next.js y los privilegios de una función.

```ts
// next.config.ts — forma de la configuración añadida
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];
// headers: async () => [{ source: "/(.*)", headers: securityHeaders }]
```

```sql
-- Nueva migración (nombre definitivo tras inspeccionar la función):
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Solo si is_username_available no fija search_path:
alter function public.is_username_available(text) set search_path = '';
```

Convenciones:

- Las migraciones se aplican con `apply_migration` y su archivo se guarda en `supabase/migrations/` con el prefijo de fecha de las existentes.
- Si `rls_auto_enable` es la función de un event trigger, `postgres` conserva el privilegio de ejecutarla; el trigger sigue funcionando al revocar a `anon`/`authenticated`.

## Implementation plan

Cada paso deja la app funcionando.

1. **Cabeceras.** Leer la guía de `headers` de Next en `node_modules/next/dist/docs/`, añadir `securityHeaders` y `headers()` a `next.config.ts`. Verificar: `npm run build` pasa y `curl -I http://localhost:3000/` (con `npm run start`) muestra las 3 cabeceras.
2. **Inspeccionar `rls_auto_enable`.** Con `execute_sql`: `pg_get_functiondef`, `pg_event_trigger` (si existe un event trigger que la use) y `has_function_privilege` por rol. Anotar el resultado en la sección «Resultado de la inspección» de este spec. No cambia nada todavía.
3. **Revocar `EXECUTE` de `rls_auto_enable`.** Migración con `apply_migration` y copia en `supabase/migrations/`. Si la inspección muestra que revocar rompería su uso real, parar y registrarlo en el spec en vez de forzar el cambio. Verificar: `has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')` es `false` para `anon`, `authenticated` y `public`.
4. **Revisar `is_username_available`.** Con `pg_get_functiondef` confirmar `search_path = ''` y retorno `boolean`; si falta el `search_path`, aplicar la migración de `alter function`. Verificar que el registro y `/auth/username` siguen comprobando la disponibilidad del nombre.
5. **Verificar avisos.** Ejecutar `get_advisors` (security). Deben quedar solo `anon_security_definer_function_executable` y `authenticated_security_definer_function_executable` de `is_username_available`, y `auth_leaked_password_protection`.
6. **Página 404 y alias `/login`.** Leer la guía de `not-found` y `redirects` en `node_modules/next/dist/docs/`, crear `app/not-found.tsx` y añadir `redirects()` a `next.config.ts`. Verificar: una ruta inexistente devuelve 404 con la pantalla nueva y `/login` redirige a `/auth`.
7. **Documentación.** Actualizar `CLAUDE.md` (cabeceras de seguridad en Architecture notes; avisos aceptados en Database) y marcar este spec como `implemented`.

## Acceptance criteria

- [ ] `next.config.ts` define `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin` para `source: '/(.*)'`.
- [ ] Con `npm run build` + `npm run start`, la respuesta de `/`, `/biblioteca`, `/juegos/asteroids/jugar` y `/auth` incluye las 3 cabeceras con esos valores exactos.
- [ ] Los 4 juegos cargan y se juegan sin errores de consola después de añadir las cabeceras, y el login con correo y el callback de `/auth/callback` siguen funcionando.
- [ ] `anon`, `authenticated` y `public` no tienen `EXECUTE` sobre `public.rls_auto_enable()` (`has_function_privilege` devuelve `false`), y existe la migración correspondiente en `supabase/migrations/`.
- [ ] `public.is_username_available(text)` tiene `search_path = ''` y devuelve `boolean`; el registro rechaza un username ya existente y acepta uno libre.
- [ ] `get_advisors` (security) ya no reporta ningún aviso sobre `rls_auto_enable`.
- [ ] `get_advisors` (security) reporta como máximo estos avisos: los 2 de `is_username_available` (intencionales) y `auth_leaked_password_protection` (fuera de este spec).
- [ ] Una ruta inexistente (p. ej. `/no-existe`) responde con estado 404 y muestra «404», «ESTA PÁGINA NO EXISTE» y los botones VOLVER AL INICIO y VER BIBLIOTECA, con `Nav` y `Footer`, en escritorio y en 390×844.
- [ ] VOLVER AL INICIO lleva a `/` y VER BIBLIOTECA a `/biblioteca`.
- [ ] `/login` redirige a `/auth`, y con sesión termina en la misma pantalla que `/auth` con sesión (no en un 404).
- [ ] `CLAUDE.md` documenta las 3 cabeceras, la página 404, el alias `/login` y la excepción de `is_username_available`.
- [ ] `npm run lint` y `npm run build` pasan sin errores.

## Decisions taken and discarded

- **Solo las 3 cabeceras del checklist** (decisión del usuario). Descartado añadir HSTS y Permissions-Policy ahora: se pueden sumar en otro spec sin conflicto.
- **No CSP:** requiere nonces y verificar `cacheComponents`, `next/font`, el canvas, Supabase y Google; es un spec propio.
- **Mantener `is_username_available` como `SECURITY DEFINER` ejecutable por `anon`** (decisión del usuario). Es necesaria antes de tener sesión y el proyecto no usa `service_role`. Descartado restringirla a `authenticated` (el registro dejaría de validar el nombre antes de enviar) y moverla a un schema no expuesto (exige clave de servicio).
- **Inspeccionar antes de revocar `rls_auto_enable`** (decisión del usuario): su origen no está versionado, así que no se asume qué hace. Se prefiere revocar a eliminarla para no perder el auto-enable de RLS en tablas nuevas.
- **Dejar fuera la protección de contraseñas filtradas** (decisión del usuario): es un ajuste del panel (o una comprobación propia con HIBP) que se aborda aparte; el WARN queda abierto y registrado.
- **404 propio en vez de redirigir todo al inicio** (ampliación del usuario): redirigir esconde el error, quita el estado 404 real y oculta enlaces rotos. Se añade además el alias `/login` → `/auth` por ser una URL que la gente intenta. Se mete en este spec por decisión del usuario, aunque no forma parte del checklist de seguridad.
- **Revocar con migración versionada** y no desde el panel, para que el cambio quede en `supabase/migrations/`.

## Identified risks

| Riesgo                                                                                 | Mitigación                                                                                                    |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `rls_auto_enable` es usada por un event trigger y revocar `EXECUTE` lo rompe           | Inspeccionar primero (paso 2); el event trigger lo ejecuta con el rol dueño. Si hay duda, no revocar y anotar |
| `X-Frame-Options: DENY` rompe un `iframe` legítimo (p. ej. un embed o la vista previa) | Verificar los 4 juegos y las pantallas de acceso (criterio de aceptación); la app no embebe páginas propias   |
| `Referrer-Policy` afecta al retorno de OAuth/Google                                    | `strict-origin-when-cross-origin` sigue enviando el origen; probar el callback tras el cambio                 |
| Las cabeceras no aparecen en `next dev` igual que en producción                        | Verificar con `npm run build` + `npm run start`, no solo en desarrollo                                        |
| Cambiar `search_path` de `is_username_available` altera su comportamiento              | La función usa nombres calificados con schema (`public.`); verificar el registro tras la migración            |

## Resultado de la inspección

**`public.rls_auto_enable()`** (inspeccionada el 2026-11-10, paso 2):

- Devuelve `event_trigger`, `SECURITY DEFINER`, dueño `postgres`, `search_path = pg_catalog`.
- Es la función del event trigger `ensure_rls` (`ddl_command_end`, tags `CREATE TABLE`, `CREATE TABLE AS`, `SELECT INTO`, habilitado). Activa RLS en cada tabla nueva del schema `public`.
- Privilegios actuales (`proacl`): `PUBLIC`, `postgres`, `anon`, `authenticated` y `service_role` tienen `EXECUTE`.
- El linter la marca porque `anon` y `authenticated` tienen `EXECUTE` y la función está en un schema expuesto (`/rest/v1/rpc/rls_auto_enable`).
- Conclusión: revocar `EXECUTE` a `PUBLIC`, `anon` y `authenticated` es seguro. Los event triggers los dispara el sistema con el rol que ejecuta el DDL y la función corre como `SECURITY DEFINER` (`postgres`); `service_role` y `postgres` conservan el privilegio.

**`public.is_username_available(text)`** (dato adelantado para el paso 4):

- Ya tiene `search_path = ''`, retorna `boolean`, es `STABLE SECURITY DEFINER` y usa nombres calificados (`public.profiles`, `public.scores`).
- `EXECUTE`: `postgres`, `anon`, `authenticated` y `service_role`; `PUBLIC` no lo tiene.
- Conclusión: no hace falta migración de `alter function`; el paso 4 queda en confirmar el comportamiento del registro.

## What is **not** in this spec

- HSTS, Permissions-Policy y CSP.
- Protección contra contraseñas filtradas (`auth_leaked_password_protection`).
- Mover o reescribir `is_username_available`.
- Rate limiting, 2FA, auditoría de dependencias.

Cada uno de esos puntos, si llega, va en su propio spec.
