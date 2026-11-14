# Migración a producción (Supabase + hosting)

Desarrollo (`dzrtinmochjrddstannm`) y producción son proyectos Supabase distintos. El agente solo tiene acceso a desarrollo: **todo lo de producción lo ejecutas tú**. Nada de esto requiere pasarle claves ni contraseñas.

**Decisión:** `scores` se migra **vacía** (sin las 50 semillas ni las marcas de prueba). `games` sí lleva su catálogo de 8 filas.

## 0. Antes de empezar

- Proyecto de producción creado y su contraseña de BD guardada en un gestor (fuera del repo).
- Dominio de producción definido (`https://<dominio>`).
- El SPEC 14 (`safeNext`, grants mínimos, límite de frecuencia, `SITE_URL`) ya está en el repo y `01-schema.sql` lo incluye. **Sin `SITE_URL` en producción, el registro, la recuperación de contraseña y Google responden error.**

## 1. Base de datos (SQL Editor de producción)

Archivos en `supabase/prod/`:

| Paso | Archivo            | Qué hace                                                                                        |
| ---- | ------------------ | ----------------------------------------------------------------------------------------------- |
| 1    | `00-preflight.sql` | Solo lectura. Esperado: sin tablas en `public`, 0 usuarios.                                     |
| 2    | `01-schema.sql`    | Esquema completo: las 12 migraciones en orden, `scores` sin semillas, `rls_auto_enable` idempotente. |
| 3    | `02-verify.sql`    | Solo lectura. La columna `ok` debe ser `true` en todas las filas.                               |

Ejecuta `01-schema.sql` **una sola vez** y completo. Si falla a mitad, no lo repitas a ciegas: pásame el error (el SQL Editor corre el script en una transacción, así que no debería quedar a medias, pero comprueba con `00-preflight.sql`).

Alternativa con CLI: `supabase link --project-ref <PROD_REF>` y `supabase db push`, pero esa vía **sí insertaría las semillas** (usa `supabase/migrations/`); para mantener `scores` vacía usa el SQL Editor, o ejecuta después `delete from public.scores where is_seed;`.

Después, en el panel: Advisors → Security. Avisos esperados: solo los aceptados de `is_username_available` y `auth_leaked_password_protection` (activarla si tu plan lo permite).

## 2. Auth (paneles de Supabase y Google)

- **URL Configuration:** _Site URL_ = `https://<dominio>`; _Redirect URLs_ = `https://<dominio>/auth/callback`.
- **Email:** «Confirm email» activo.
- **SMTP propio** (Resend, con dominio verificado; `onboarding@resend.dev` no sirve en producción) y revisar plantillas: los enlaces deben usar `{{ .ConfirmationURL }}`.
- **Google:** crea un cliente OAuth de producción en Google Cloud Console. URI de redirección autorizado: `https://<PROD_REF>.supabase.co/auth/v1/callback`; origen autorizado: `https://<dominio>`. Pega Client ID y Secret en Supabase → Providers → Google.

## 3. Variables de entorno del hosting

| Variable                               | Valor en producción                                            |
| -------------------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL del proyecto de **producción**                             |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key de **producción**                              |
| `RESEND_API_KEY`                       | clave de Resend de producción                                  |
| `CONTACT_TO_EMAIL`                     | correo que recibe los mensajes                                 |
| `CONTACT_FROM_EMAIL`                   | remitente de un dominio verificado en Resend                   |
| `SITE_URL`                             | `https://<dominio>` (**obligatoria**; sin barra final) |

No definas `ALLOWED_DEV_ORIGINS`. Nunca uses una secret/service_role key (la app no la usa). Las `NEXT_PUBLIC_SUPABASE_*` deben estar también en el entorno de **build** (`generateStaticParams` lee `games`).

## 4. Verificación de punta a punta

1. `/biblioteca` muestra los 8 juegos; `/salon` y los leaderboards están vacíos (sin marcas: es lo esperado al migrar `scores` vacía).
2. Registro con correo real → llega el correo → el enlace confirma y entra a la app.
3. Recuperar contraseña; login con Google; elegir username.
4. Jugar una partida con sesión: `GUARDADO #1` y aparece en `/salon`. Como invitado: enlace a `/auth`.
5. `POST /rest/v1/scores` anónimo directo con la publishable key debe fallar por RLS.
6. `curl -I https://<dominio>/` muestra `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`.
7. Formulario de `/acerca-de` entrega el correo.

## 5. Cambios futuros

Primero en desarrollo con `apply_migration`, guarda el `.sql` en `supabase/migrations/` y aplícalo a mano en producción (`supabase/prod/` se regenera solo para el despliegue inicial). Nunca edites producción sin migración. Activa backups en producción antes de abrirla al público.
