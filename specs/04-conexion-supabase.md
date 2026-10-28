# SPEC 04 — Conexión de la app con Supabase

> **Status:** implemented
> **Depends on:** SPEC 03
> **Date:** 2026-10-27
> **Objective:** Conectar la app Next.js con el proyecto de Supabase mediante `@supabase/supabase-js` y `@supabase/ssr`, con clientes de navegador y de servidor y variables de entorno, sin crear tablas ni cambiar ningún comportamiento visible.

---

## Por qué existe este spec

La app todavía no usa Supabase: la sesión es un mock en `localStorage` (`av_user`, `components/session-provider.tsx`) y las puntuaciones salen de `seededScores` (`lib/scores.ts`). El proyecto de Supabase ya está enlazado por MCP (`.mcp.json`) y su esquema `public` está vacío.

La integración completa (Auth, puntuaciones, contacto) abarca varios dominios, así que se divide. Este spec es solo la **base de conexión**; cada dominio posterior lo consume en su propio spec.

## Scope

**In:**

- Dependencias `@supabase/supabase-js` y `@supabase/ssr`.
- Cliente de navegador en `lib/supabase/client.ts`.
- Cliente de servidor en `lib/supabase/server.ts`, con manejo de cookies para Server Components, Server Actions y Route Handlers.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, declaradas vacías en `.env.example` y con valores reales solo en `.env.local`.
- Comprobación puntual de la conexión con un script fuera del repo.
- Nota breve en `CLAUDE.md` (Architecture notes) sobre `lib/supabase/` y las variables.

**Out of scope (para specs futuros):**

- Crear tablas, migraciones, políticas RLS o la carpeta `supabase/`.
- Supabase Auth en cualquier forma: correo y contraseña, invitado anónimo, OAuth Google/GitHub. El mock `SessionProvider` y `AuthForm` no se tocan.
- Refrescar la sesión en cada petición (interceptor de Next); solo tiene sentido cuando exista Auth.
- Puntuaciones reales en lugar de `seededScores`.
- Guardar los mensajes de contacto del SPEC 03.
- Tipos generados de la base de datos (`generate_typescript_types`); con el esquema vacío no aportan nada.
- `SUPABASE_SECRET_KEY` / `service_role` y cualquier cliente con privilegios.
- Route Handler `/api/health` u otro endpoint permanente de comprobación.
- Supabase CLI local, branching y entornos separados de desarrollo y producción.

## Data model

Esta feature no introduce tablas ni estructuras de datos persistentes. Añade dos variables de entorno y dos funciones.

Variables de entorno (ambas públicas por diseño; van al bundle del cliente):

| Variable                               | Uso                                                          |
| -------------------------------------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL del proyecto, p. ej. `https://<project_ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publishable (`sb_publishable_...`)                     |

```ts
// lib/supabase/client.ts  — para Client Components
export function createClient(): SupabaseClient;

// lib/supabase/server.ts  — para Server Components, Server Actions y Route Handlers
export async function createClient(): Promise<SupabaseClient>;
```

Convenciones:

- Los clientes no tienen tipo `Database` todavía; se añade en el primer spec que cree tablas.
- El cliente de servidor se crea **dentro de cada petición**, nunca como constante de módulo ni global.
- Si falta una variable, la función lanza un `Error` cuyo mensaje nombra la variable ausente.
- La URL y la clave no se escriben en el código ni en `.env.example`; solo en `.env.local`.

## Implementation plan

Antes de empezar: leer en `node_modules/next/dist/docs/` lo relativo a variables de entorno y a `cookies()` bajo `cacheComponents` (ver `CLAUDE.md`), y confirmar con `search_docs` del MCP de Supabase la API vigente de `createBrowserClient` / `createServerClient` y el nombre de la clave publishable.

1. **Instalar dependencias.** `npm install @supabase/supabase-js @supabase/ssr`. Revisar que no haya conflictos de peer dependencies con `next` 16.4 y React 19.3. Verificar: `npm run build` pasa.
2. **Variables de entorno.** Obtener la URL y la clave publishable con `get_project_url` y `get_publishable_keys` del MCP. Escribirlas en `.env.local`. Añadir las dos variables vacías, con un comentario breve, a `.env.example` sin tocar las de Resend. Verificar: `git check-ignore .env.local` lo confirma ignorado y `git status` no lo lista.
3. **Cliente de navegador.** Crear `lib/supabase/client.ts` con `createBrowserClient`. Verificar: `npx tsc --noEmit` pasa.
4. **Cliente de servidor.** Crear `lib/supabase/server.ts` con `createServerClient` y el adaptador de cookies de `next/headers` (`getAll` / `setAll`). El `setAll` tolera el error al escribir cookies desde un Server Component. Verificar: `npx tsc --noEmit`, `npm run lint` y `npm run build` pasan.
5. **Comprobar la conexión.** Ejecutar una vez un script en el directorio scratchpad, no en el repo, que cree un cliente con las mismas variables y consulte una tabla inexistente. Con clave válida esperar el error `PGRST205`; con una clave alterada, un error de API key inválida; sin variables, el mensaje claro del paso 3. Verificar: los tres resultados coinciden y el script no queda en el repo.
6. **Documentar.** Añadir a `CLAUDE.md`, en Architecture notes, un punto con la ubicación de los clientes (`lib/supabase/`), el patrón de crearlos por petición y las dos variables. Verificar: `git diff` de `CLAUDE.md` muestra solo esa adición.

## Acceptance criteria

**Build y dependencias**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] `package.json` lista `@supabase/supabase-js` y `@supabase/ssr` en `dependencies`.
- [ ] `npm run build` pasa también sin `.env.local` (los clientes no se crean al importar el módulo).

**Configuración y secretos**

- [ ] `.env.example` contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sin valor, y conserva las variables de Resend.
- [ ] `git check-ignore .env.local` devuelve la ruta (está ignorado).
- [ ] Ninguna clave real está versionada: `git grep -E "sb_(publishable|secret)_[A-Za-z0-9_-]{20,}"` no devuelve resultados en todo el repo.
- [ ] La URL del proyecto no está escrita en el código ni en las plantillas de entorno: `git grep -n "\.supabase\.co" -- app components lib .env.example .env.template` no devuelve resultados.
- [ ] No se define ni se usa una clave privilegiada: `git grep -nE "^\s*SUPABASE_(SECRET_KEY|SERVICE_ROLE_KEY)=|process\.env\.SUPABASE_|service_role" -- app components lib .env.template` no devuelve resultados.

**Clientes**

- [ ] `lib/supabase/client.ts` exporta `createClient` y no importa `next/headers`.
- [ ] `lib/supabase/server.ts` exporta una función asíncrona `createClient` que lee las cookies con `cookies()` de `next/headers`.
- [ ] Ninguno de los dos archivos crea un cliente fuera de la función exportada.
- [ ] Con una variable ausente, `createClient` lanza un error cuyo mensaje contiene el nombre de esa variable.

**Conexión**

- [ ] Con la URL y la clave reales, la consulta a una tabla inexistente devuelve el código `PGRST205`.
- [ ] Con la clave alterada, la misma consulta falla con un error de API key inválida y no con `PGRST205`.

**Sin efectos colaterales**

- [ ] `list_tables` del MCP sobre el esquema `public` devuelve una lista vacía.
- [ ] No existe la carpeta `supabase/` ni ningún archivo de migración.
- [ ] Ningún archivo de `app/` ni de `components/` importa `lib/supabase/`.
- [ ] `components/session-provider.tsx` y `components/auth-form.tsx` no aparecen en `git diff`.
- [ ] `git status` lista solo `package.json`, `package-lock.json`, `.env.example`, `CLAUDE.md` y `lib/supabase/`.

## Decisions

- **Sí:** `@supabase/ssr` además de `supabase-js`. El spec de Auth lo necesitará para manejar sesión por cookies, y así no hay que rehacer los clientes.
- **No:** solo `supabase-js`. Es más simple hoy, pero duplica trabajo cuando llegue Auth.
- **Sí:** clave publishable (`sb_publishable_...`). Es el formato actual de clave pública y no da privilegios por sí sola.
- **No:** clave secret / `service_role`. No hay ningún uso todavía y filtrarla sería grave; entra cuando un spec la necesite.
- **Sí:** dos clientes separados (`client.ts` y `server.ts`). Los Client Components no pueden usar `next/headers`, y el código de servidor necesita cookies.
- **Sí:** el cliente de servidor se crea por petición. Con `cacheComponents` y entornos serverless, un cliente global puede compartir cookies entre usuarios.
- **Sí:** comprobación con script puntual fuera del repo. Decisión del usuario; evita dejar una ruta pública que nadie pidió.
- **No:** Route Handler `/api/health` permanente. Útil para despliegue, pero amplía la superficie sin necesidad hoy.
- **Sí:** consultar una tabla inexistente como prueba. `PGRST205` demuestra que la URL responde y que la clave es aceptada, sin crear nada en la base.
- **Sí:** migraciones SQL versionadas en `supabase/migrations/` y aplicadas con `apply_migration` cuando exista esquema. Decisión tomada ahora para los próximos specs; este spec no crea la carpeta porque no cambia el esquema.
- **No:** crear tablas, Auth ni puntuaciones aquí. Decisión del usuario: por ahora solo conectar la app.
- **No:** generar tipos de la base de datos. Con `public` vacío el archivo estaría vacío; se genera en el primer spec con tablas.
- **Sí:** documentar en `CLAUDE.md`. Es la guía que lee cada sesión y evita que se cree un cliente global por error.

## Risks

| Riesgo                                                                                                                          | Mitigación                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cookies()` es una API de petición y `cacheComponents` cambia su semántica (debe usarse bajo `<Suspense>` o en rutas dinámicas) | Leer la documentación antes del paso 4; el cliente de servidor solo se crea dentro de la función, y el uso real queda para los specs que lo consuman              |
| El cliente de servidor no se ejecuta en runtime en este spec, así que un fallo de cookies solo se vería en el spec de Auth      | Aceptado. El tipado, el lint y el build lo validan; la prueba de cookies es criterio del spec de Auth                                                             |
| Poner una clave secreta en una variable `NEXT_PUBLIC_` la expone al bundle                                                      | Solo se configura la publishable; el criterio de aceptación busca `sb_secret_` y `service_role` en archivos versionados                                           |
| La clave publishable queda visible en el bundle                                                                                 | Es pública por diseño; la seguridad depende de RLS. Con `public` vacío no hay datos expuestos, y todo spec que cree tablas debe activar RLS en la misma migración |
| Incompatibilidad de `@supabase/ssr` con Next 16.4 o React 19.3                                                                  | Revisar peer dependencies en el paso 1 y confirmar la API vigente con la documentación de Supabase                                                                |
| El dev server no recoge variables nuevas de `.env.local`                                                                        | Reiniciar `npm run dev` tras el paso 2                                                                                                                            |

## What is **not** in this spec

- Tablas, migraciones, RLS ni carpeta `supabase/`.
- Auth de ningún tipo (correo, anónimo u OAuth) ni cambios al mock de sesión.
- Puntuaciones reales ni almacenamiento de mensajes de contacto.
- Tipos generados de la base de datos.
- Secret key, `service_role` o clientes con privilegios.
- Endpoints permanentes de comprobación de salud.
- Refresco de sesión por petición.

Cada uno de estos puntos, si se aborda, va en su propio spec.
