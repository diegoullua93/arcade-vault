# SPEC 15 — Cabeceras HTTP adicionales y límite de frecuencia del formulario de contacto (hallazgos SEC-09 y SEC-11)

> **Status:** draft
> **Depends on:** SPEC 03, SPEC 13
> **Date:** 2026-11-13
> **Objective:** Añadir `Strict-Transport-Security` y `Permissions-Policy`, dejar de enviar `X-Powered-By` y limitar la frecuencia de envíos del formulario de contacto con un contador en Supabase.

---

## Por qué existe este spec

El SPEC 13 aplicó solo las 3 cabeceras del checklist y dejó fuera HSTS, Permissions-Policy y CSP. La auditoría del 2026-11-13 (`security-findings.md`) añade dos puntos: `X-Powered-By: Next.js` sigue enviándose (SEC-11) y la Server Action `sendContactMessage` se puede llamar en bucle, lo que agota la cuota de Resend y llena el buzón (SEC-09; el honeypot no frena una llamada directa). Es el segundo de dos specs: el SPEC 14 cubre la autenticación y la base de datos.

## Scope

**In:**

- **Cabeceras** en `next.config.ts` (`securityHeaders`, para `source: '/(.*)'`):
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`.
  - `poweredByHeader: false` para quitar `X-Powered-By`.
  - Antes de escribir el código, leer la guía de `headers` y `poweredByHeader` en `node_modules/next/dist/docs/`.
- **Límite de frecuencia del contacto (SEC-09):**
  - Tabla `public.contact_attempts` con RLS activa y sin políticas ni grants para `anon`/`authenticated`.
  - Función `public.check_contact_rate(p_key text)` (`SECURITY DEFINER`, `search_path = ''`, `EXECUTE` solo para `anon` y `authenticated`): borra intentos con más de una hora, cuenta los de la clave en los últimos 10 minutos, y si hay menos de 3 registra uno y devuelve `true`; si no, devuelve `false`.
  - `sendContactMessage` calcula la clave como `sha256` (hex) de la IP del cliente (`x-forwarded-for`, primer valor; si falta, `x-real-ip`; si faltan ambos, la cadena `unknown`), llama a la función por RPC antes de validar y de enviar, y responde con un error `rate_limited` si devuelve `false`.
  - `ContactResult` (`lib/contact.ts`) gana el error `rate_limited` y `ContactForm` lo muestra con un mensaje propio.
- **Documentación:** `CLAUDE.md` (cabeceras activas, tabla y función del límite, el aviso del linter que se acepta) y `security-findings.md` (mover SEC-09 y SEC-11 a «Corregidos» tras verificarlos).

**Out of scope (for future specs):**

- **CSP**, en cualquiera de sus modos (decisión del usuario): exige nonces y verificar `cacheComponents`, `next/font`, el canvas de los juegos, Supabase y Google.
- Cabeceras `Cross-Origin-*`, `preload` de HSTS y registro del dominio en la lista de precarga.
- Límite de frecuencia para el login, el registro o `saveScore` (los dos primeros los gestiona Supabase Auth; `saveScore` lo cubre el SPEC 14).
- Captcha, verificación de correo en el formulario de contacto y cualquier servicio externo de rate limiting.
- Tests automáticos (no hay runner; se verifica con `curl`, el navegador y `execute_sql`).

## Data model

```ts
// next.config.ts — cabeceras añadidas a securityHeaders
{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
// y, en el objeto de configuración:
// poweredByHeader: false
```

```ts
// lib/contact.ts
export type ContactError = "invalid" | "send_failed" | "rate_limited"; // rate_limited es nuevo
export const CONTACT_RATE = { max: 3, windowMinutes: 10 } as const;
```

```sql
create table public.contact_attempts (
  id bigint generated always as identity primary key,
  key text not null,                       -- sha256 hex de la IP
  created_at timestamptz not null default now()
);
alter table public.contact_attempts enable row level security;   -- sin políticas
create index contact_attempts_key_created_at_idx on public.contact_attempts (key, created_at desc);
revoke all on public.contact_attempts from anon, authenticated;

-- public.check_contact_rate(p_key text) returns boolean
--   SECURITY DEFINER, set search_path = '', EXECUTE solo anon y authenticated.
```

Convenciones:

- La IP nunca se guarda en claro: solo su `sha256` en hexadecimal.
- La limpieza de intentos viejos ocurre dentro de la propia función, sin cron.
- La migración se guarda en `supabase/migrations/` con prefijo de fecha mayor que el de la última migración del SPEC 14 (o que `20261110130000` si este spec se implementa antes), y después se regeneran los tipos con `generate_typescript_types`.
- `HSTS` solo lo honran los navegadores sobre HTTPS; en `http://localhost` no tiene efecto.

## Implementation plan

Cada paso deja la app funcionando y se puede commitear solo.

1. **Cabeceras.** Leer las guías de Next, añadir HSTS y Permissions-Policy a `securityHeaders` y `poweredByHeader: false` a `next.config.ts`. Verificar: `npm run build` pasa y, con `npm run start`, `curl -I http://localhost:3000/` muestra las 5 cabeceras y no muestra `X-Powered-By`.
2. **Tabla y función.** Migración con `contact_attempts`, el índice y `check_contact_rate`. Verificar con `execute_sql`: tres llamadas con la misma clave devuelven `true`, la cuarta `false`, y otra clave devuelve `true`.
3. **Tipos.** Regenerar `lib/supabase/database.types.ts`. Verificar que `npm run build` compila con la función nueva en `Database["public"]["Functions"]`.
4. **Acción del servidor.** En `app/acerca-de/actions.ts`: calcular la clave, llamar a `check_contact_rate` con el cliente de `lib/supabase/server.ts` y devolver `rate_limited` si falla el límite. Si la propia llamada RPC da error, dejar pasar el envío y registrar el fallo (decisión: ver «Decisions»). Añadir `rate_limited` a `ContactResult` y `CONTACT_RATE` a `lib/contact.ts`.
5. **Formulario.** En `components/about/contact-form.tsx`, mostrar el mensaje «Has enviado demasiados mensajes. Prueba de nuevo en unos minutos.» para `rate_limited`, con el mismo estilo que los otros errores.
6. **Documentación.** Actualizar `CLAUDE.md` y `security-findings.md`, ejecutar `get_advisors` (security), `npm run lint` y `npm run build`.

## Acceptance criteria

- [ ] Con `npm run build` + `npm run start`, la respuesta de `/`, `/biblioteca`, `/juegos/asteroids/jugar` y `/auth` incluye `Strict-Transport-Security: max-age=31536000; includeSubDomains` y `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`, además de las 3 cabeceras del SPEC 13.
- [ ] Ninguna de esas respuestas incluye la cabecera `X-Powered-By`.
- [ ] Los 4 juegos cargan y se juegan sin errores de consola tras añadir las cabeceras, y el login con correo, Google y `/auth/callback` siguen funcionando.
- [ ] `contact_attempts` tiene RLS activa y `anon` y `authenticated` no tienen ningún privilegio sobre la tabla (consulta a `role_table_grants` y a `pg_class.relrowsecurity`).
- [ ] `check_contact_rate` tiene `search_path = ''`, es `SECURITY DEFINER`, devuelve `boolean` y `PUBLIC` no tiene `EXECUTE`.
- [ ] Tres envíos seguidos desde la misma IP se aceptan y el cuarto, en los 10 minutos siguientes, muestra el mensaje de límite sin enviar ningún correo.
- [ ] Pasados 10 minutos (o borrando las filas de la clave) el mismo cliente puede volver a enviar.
- [ ] Un cliente con otra IP (otra clave) no se ve afectado por el límite del primero.
- [ ] La tabla `contact_attempts` no contiene IPs en claro: la columna `key` tiene 64 caracteres hexadecimales.
- [ ] El honeypot, la validación de límites de campo y el envío por Resend siguen funcionando como en el SPEC 03.
- [ ] `get_advisors` (security) reporta como máximo los 3 avisos ya aceptados más los 2 de `check_contact_rate` (`SECURITY DEFINER` ejecutable por `anon` y `authenticated`), documentados como intencionales.
- [ ] `CLAUDE.md` documenta las cabeceras nuevas, la tabla y la función; `security-findings.md` mueve SEC-09 y SEC-11 a «Corregidos».
- [ ] `npm run lint` y `npm run build` pasan sin errores.

## Decisions taken and discarded

- **Yes:** HSTS, Permissions-Policy y quitar `X-Powered-By`, sin CSP (decisión del usuario). Son cambios que no pueden romper la app; CSP sigue en su propio spec futuro, como decidió el SPEC 13.
- **Yes:** `max-age=31536000; includeSubDomains`, sin `preload`. Entrar en la lista de precarga es difícil de revertir y no es necesario ahora. `includeSubDomains` es seguro mientras todos los subdominios se sirvan por HTTPS; si no se está seguro, se quita.
- **Yes:** tabla en Supabase con RPC para el límite (decisión del usuario). Funciona con varias instancias y sin servicios nuevos. **No:** `Map` en memoria del proceso (se pierde al reiniciar y no sirve en serverless) ni dejarlo fuera.
- **Yes:** 3 envíos cada 10 minutos por IP. Es holgado para una persona y poco para un bucle. El valor se cambia en `CONTACT_RATE` y en la función.
- **Yes:** guardar el `sha256` de la IP y no la IP, para no almacenar un dato personal que no hace falta leer.
- **Yes:** si falla la llamada RPC del límite, el envío continúa y se registra el error. Un fallo de Supabase no debe impedir que alguien escriba al equipo; el coste es que el límite se desactiva mientras dure el fallo.
- **Yes:** aceptar el aviso 0028/0029 de `check_contact_rate` por la misma razón que el de `is_username_available`: el proyecto no usa `service_role` y la función debe ser invocable sin sesión.
- **No:** captcha. Añade fricción y una dependencia externa para un formulario de bajo tráfico.

## Identified risks

| Riesgo                                                                                                   | Mitigación                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `X-Forwarded-For` lo controla el cliente si la plataforma de despliegue no lo sobrescribe                | El límite frena bucles sencillos, no a un atacante decidido; anotarlo en `security-findings.md`. Con la plataforma real, usar su cabecera de IP fiable |
| Mucha gente tras la misma IP (red de empresa o NAT) comparte el límite                                   | 3 por 10 minutos es suficiente para un formulario de contacto; ajustar `CONTACT_RATE` si se queja alguien                                              |
| HSTS con `includeSubDomains` fuerza HTTPS en subdominios que aún sirvan HTTP                             | Confirmar que no existen subdominios sin HTTPS antes de activarlo en producción                                                                        |
| Un navegador que ya vio HSTS no permite volver a HTTP (también en `localhost` si se sirviera con HTTPS)  | No se envía `preload`; el valor se puede bajar a `max-age=0` para revertir                                                                             |
| `Permissions-Policy` bloquea una API que algún juego use en el futuro (p. ej. `gamepad` no está listada) | Se listan solo cámara, micrófono, geolocalización, pagos y USB; los juegos actuales no usan ninguna                                                    |

## What is **not** in this spec

- CSP en cualquiera de sus modos (activa o `Report-Only`).
- Validación de partidas en servidor, rate limiting de `saveScore` y de la autenticación (SPEC 14 y Supabase Auth).
- Captcha, servicios externos de rate limiting y `preload` de HSTS.
- Fusionar la actualización de Next.js y las limpiezas manuales (SEC-01, 07, 10).

Cada uno de esos puntos, si llega, va en su propio spec.
