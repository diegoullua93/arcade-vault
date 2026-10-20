# SPEC 03 — Pantalla "Acerca de" y envío real del formulario de contacto

> **Status:** aprobado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-10-20
> **Objective:** Implementar la ruta `/acerca-de` según `references/templates/home-about/about.jsx` y hacer que su formulario de contacto envíe un correo real al equipo con Resend mediante una Server Action.

---

## Por qué existe este spec

El SPEC 02 dejó fuera `about.jsx` y el enlace "Acerca de" del Nav para no crear un link roto. Este spec cierra ese pendiente. Además, el template solo simula el envío (`setSent(...)` sin red), así que aquí se añade el primer código de servidor de la app: una Server Action, una dependencia externa (`resend`) y variables de entorno.

Archivos de referencia en `references/templates/home-about/`:

| Archivo | Contenido relevante |
| --- | --- |
| `about.jsx` | Pantalla About: hero con misión y 3 highlights, divisor de píxeles y sección Contacto con formulario y éxito tipo terminal |
| `nav.jsx` | Nav con el enlace "Acerca de" (escritorio y panel móvil) |
| `styles.css` | Sección `/* ===== ABOUT PAGE ===== */` (líneas ~1071–1150) |
| `arcade-vault-standalone.html` | Bundle completo con la ruta `about`; referencia visual |

## Scope

**In:**

- Ruta `/acerca-de` con:
  - Hero: kicker "▸ ACERCA DE", título "ACERCA DE ARCADE VAULT", texto de misión y 3 highlights con icono pixel (HEART, BROWSER, PLANT).
  - Divisor decorativo de 24 píxeles animados entre las dos secciones.
  - Sección Contacto: kicker "▸ CONTACTO", título "CONTÁCTANOS", subtítulo, 3 tips con LED y formulario.
- Formulario con campos NOMBRE, CORREO ELECTRÓNICO y MENSAJE, y botón "▶  ENVIAR MENSAJE".
- Estados del formulario: inicial, enviando, éxito (terminal "VAULT-OS // TERMINAL" con `ENVIAR OTRO MENSAJE`), error inline y validación vacía con animación `shake`.
- Server Action `sendContactMessage` que valida en el servidor y envía un correo al equipo con Resend. `replyTo` = correo del visitante.
- Honeypot oculto como protección anti-bot.
- Animación de aparición al scroll reutilizando `components/home/reveal.tsx` del SPEC 02.
- Enlace "Acerca de" en el Nav (escritorio y panel móvil), activo en `/acerca-de`.
- CSS de la sección ABOUT PAGE del template añadido a `app/globals.css`.
- Variables de entorno `RESEND_API_KEY`, `CONTACT_TO_EMAIL` y `CONTACT_FROM_EMAIL`, documentadas en `.env.example`.
- Validación visual manual de la pantalla contra `arcade-vault-standalone.html`.

**Out of scope (para specs futuros):**

- Correo de acuse de recibo al visitante.
- Rate limit por IP u otro store externo (Upstash, Redis).
- Guardar los mensajes en base de datos o panel de administración.
- Captcha o verificación de correo.
- Precargar el nombre desde la sesión mock (`av_user`).
- Validación automatizada con Playwright (rectángulos y capturas); se hace revisión visual manual.
- Plantillas de correo HTML elaboradas (se envía texto plano).
- Dominio propio verificado en Resend: en desarrollo se usa el remitente de pruebas de Resend.
- Editar los SPEC 01 y 02 como documentos.

## Data model

Estructuras nuevas, solo tipos y constantes; no hay persistencia.

```ts
// lib/contact.ts
export const CONTACT_LIMITS = { name: 60, email: 120, message: 2000 } as const;

export type ContactInput = {
  name: string;
  email: string;
  message: string;
};

export type ContactResult =
  | { ok: true; name: string }          // name ya normalizado, para el saludo del terminal
  | { ok: false; error: "invalid" | "send_failed" };

export const HIGHLIGHTS: {
  icon: "HEART" | "BROWSER" | "PLANT";
  text: string;
  color: "magenta" | "cyan" | "green";
}[];                                     // 3 elementos, textos del template

export const CONTACT_TIPS: { text: string; led?: "y" | "m" }[]; // 3 elementos
```

```ts
// app/acerca-de/actions.ts  ("use server")
export async function sendContactMessage(input: ContactInput & { website?: string }): Promise<ContactResult>;
```

Variables de entorno (servidor, nunca `NEXT_PUBLIC_`):

| Variable | Uso |
| --- | --- |
| `RESEND_API_KEY` | API key de Resend |
| `CONTACT_TO_EMAIL` | Destinatario del equipo |
| `CONTACT_FROM_EMAIL` | Remitente; en desarrollo `onboarding@resend.dev` |

Convenciones:

- El campo honeypot se llama `website`; un valor no vacío devuelve `{ ok: true }` sin enviar nada, para no dar pistas al bot.
- Validación del servidor: tres campos con `trim()` no vacíos, correo con formato válido, y longitudes dentro de `CONTACT_LIMITS`. Falla → `{ ok: false, error: "invalid" }`.
- Cualquier excepción o `error` de Resend → `{ ok: false, error: "send_failed" }`. No se devuelve el mensaje interno al cliente.
- Asunto del correo: `[Arcade Vault] Mensaje de <nombre>`. Cuerpo en texto plano con nombre, correo y mensaje.
- Los saltos de línea del visitante no se interpretan como cabeceras: nombre y asunto se sanean quitando `\r` y `\n`.
- No se usa `Date` ni `Math.random` en el render (evita hydration mismatch).

## Implementation plan

Antes de empezar: leer en `node_modules/next/dist/docs/` lo relativo a Server Actions y Forms, Client Components y variables de entorno (ver `CLAUDE.md`), con atención a `cacheComponents`.

1. **Enlace en el Nav.** En `components/nav.tsx` añadir "Acerca de" → `/acerca-de` en la barra y en el panel móvil, activo con `usePathname() === "/acerca-de"`. Crear `app/acerca-de/page.tsx` con un placeholder mínimo para que el enlace no quede roto. Verificar: el enlace navega y se resalta.
2. **CSS de About.** Añadir a `app/globals.css` la sección ABOUT PAGE de `references/templates/home-about/styles.css`. Comprobar que existen `.shake`, estilos de `textarea` en `.field` y las clases del terminal (`.terminal-success`, `.term-bar`, `.dot`, `.prompt`, `.caret`); si faltan en esa sección, copiarlas del template. Usar prefijo `av-` en cualquier `@keyframes` nuevo y verificar que no chocan con los de Tailwind v4 (ver SPEC 02, Risks). Verificar: `npm run build` pasa.
3. **Datos y tipos.** Crear `lib/contact.ts` con `CONTACT_LIMITS`, tipos, `HIGHLIGHTS` y `CONTACT_TIPS`. Verificar: `npx tsc --noEmit` pasa.
4. **Sección About.** Crear `components/about/highlight-icon.tsx` (3 SVG) y `components/about/about-hero.tsx` (Server Component). Montar hero y divisor en `app/acerca-de/page.tsx` con `<Reveal>` en el divisor. Verificar: se ve el hero y el divisor.
5. **Instalar Resend y variables.** `npm install resend`. Crear `.env.example` con las tres variables vacías. Confirmar que `.env*.local` está ignorado en `.gitignore`. Verificar: `npm run build` pasa.
6. **Server Action.** Crear `app/acerca-de/actions.ts` con `sendContactMessage` según el Data model: honeypot, validación, saneado, envío con Resend y mapeo de errores. Verificar: `npx tsc --noEmit` y `npm run lint` pasan.
7. **Formulario.** Crear `components/about/contact-form.tsx` (Client Component) con los estados inicial, enviando, éxito y error. Validación vacía en cliente con `shake` de 400 ms; `useTransition` para el estado "enviando" con el botón deshabilitado. Éxito muestra el terminal con `> MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {NOMBRE}.` (nombre en mayúsculas, como el template); "ENVIAR OTRO MENSAJE" limpia el formulario. Error conserva los valores y muestra una línea `[ERROR] No se pudo enviar el mensaje. Inténtalo de nuevo.` con el estilo de línea de terminal. Honeypot: `<input name="website">` fuera de pantalla, `tabIndex={-1}`, `autoComplete="off"`, `aria-hidden`.
8. **Sección Contacto.** Crear `components/about/contact-section.tsx` (intro + tips + `<ContactForm />`) y montarla en `app/acerca-de/page.tsx` con `<Reveal>`. Añadir metadata de la página (`Acerca de · Arcade Vault`). Verificar: la pantalla completa se ve como la referencia.
9. **Prueba real de envío.** Con `.env.local` configurado con una API key de desarrollo, enviar un mensaje desde `/acerca-de` y comprobar que llega a `CONTACT_TO_EMAIL`. Verificar también el camino de error quitando `RESEND_API_KEY`.
10. **Revisión visual.** Abrir `arcade-vault-standalone.html` en la ruta Acerca de y `http://localhost:3000/acerca-de` a 1440×900 y 390×844 y corregir diferencias en `globals.css` o los componentes.

## Acceptance criteria

**Build y rutas**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores y generan `/acerca-de`.
- [ ] El repo no contiene ninguna API key; `.env.example` existe y `.env.local` no está versionado.
- [ ] `RESEND_API_KEY` no aparece en ningún archivo de `.next/static`.

**Navegación**

- [ ] El Nav muestra "Inicio", "Biblioteca", "Salón de la Fama" y "Acerca de", tanto en escritorio como en el panel móvil a 390 px.
- [ ] "Acerca de" navega a `/acerca-de` y está activo solo en esa ruta.
- [ ] En `/acerca-de` el Nav no marca ningún otro enlace como activo.

**Contenido de la pantalla**

- [ ] `/acerca-de` muestra el título "ACERCA DE ARCADE VAULT", el texto de misión y 3 highlights.
- [ ] El divisor contiene 24 píxeles.
- [ ] La sección Contacto muestra el título "CONTÁCTANOS", 3 tips y un formulario con 3 campos visibles.
- [ ] El honeypot `website` existe en el DOM, no es visible ni accesible por tabulación.
- [ ] Las secciones con `.reveal` pasan a `in` al hacer scroll y se muestran sin animación con `prefers-reduced-motion: reduce`.
- [ ] La consola del navegador no muestra errores de hidratación en `/acerca-de`.

**Formulario y envío**

- [ ] Enviar con cualquier campo vacío (o solo espacios) no llama a la Server Action y aplica la clase `shake` durante ~400 ms.
- [ ] Enviar datos válidos muestra el terminal con "MENSAJE RECIBIDO" y el nombre en mayúsculas.
- [ ] Mientras se envía, el botón está deshabilitado.
- [ ] El correo llega a `CONTACT_TO_EMAIL` con asunto `[Arcade Vault] Mensaje de <nombre>`, cuerpo con nombre, correo y mensaje, y `Reply-To` igual al correo del visitante.
- [ ] "ENVIAR OTRO MENSAJE" vuelve al formulario con los tres campos vacíos.
- [ ] Sin `RESEND_API_KEY` el envío no muestra éxito: aparece la línea `[ERROR] …`, los valores escritos se conservan y el botón vuelve a estar activo.
- [ ] Llamar a la Server Action con un correo mal formado, un mensaje de más de 2000 caracteres o un campo vacío devuelve `{ ok: false, error: "invalid" }` y no envía correo.
- [ ] Llamar a la Server Action con `website` no vacío devuelve `{ ok: true }` y no envía correo.
- [ ] Un nombre con `\r\n` no introduce cabeceras adicionales en el asunto del correo.

**Revisión visual (manual, contra `arcade-vault-standalone.html`)**

- [ ] A 1440×900 y a 390×844 hero, divisor, sección Contacto y estado de éxito coinciden en disposición, color y tipografía con la referencia, salvo el estado de error (no existe en el template).
- [ ] A 390×844 no hay desbordamiento horizontal en `/acerca-de`.

## Decisions

- **Sí:** Resend. API HTTP sin servidor SMTP, plan gratuito y SDK pequeño.
- **No:** Nodemailer + SMTP. Más configuración, y los puertos SMTP suelen estar bloqueados en entornos serverless.
- **Sí:** Server Action. No expone un endpoint público que documentar y encaja con el App Router.
- **No:** Route Handler `app/api/contacto`. Solo valdría si otro cliente consumiera la API.
- **Sí:** ruta `/acerca-de`, coherente con `/biblioteca` y `/salon`.
- **No:** `/about`. Es el nombre del template, pero rompe la convención en español del repo.
- **Sí:** correo solo al equipo con `replyTo` del visitante. Es lo que promete el template ("TE RESPONDEREMOS PRONTO") sin duplicar plantillas.
- **No:** acuse al visitante. Convierte el formulario en un posible relay de spam y duplica trabajo.
- **Sí:** validación en el servidor más honeypot. La validación del cliente es solo UX, no se confía en ella; el honeypot frena bots simples sin dependencias.
- **No:** rate limit en este spec. En serverless exige un store externo y amplía el alcance; se aborda en otro spec si se detecta abuso.
- **Sí:** honeypot devuelve `ok: true` silencioso. Un bot no aprende que fue detectado.
- **Sí:** estado de error inline con el estilo de terminal y valores conservados. El template no lo define; se diseña con el CSS existente para no perder lo que el usuario escribió.
- **Sí:** texto plano en el correo. Cero superficie de inyección HTML.
- **No:** precargar el nombre desde `av_user`. Sesión mock; añade lectura de `localStorage` y riesgo de hydration sin valor real.
- **Sí:** revisión visual manual en lugar de Playwright. Decisión del usuario; el SPEC 02 ya validó el CSS base, así que el riesgo se limita a la sección ABOUT.
- **Sí:** reutilizar `components/home/reveal.tsx` sin moverlo. Evita tocar archivos del SPEC 02 sin necesidad.
- **Sí:** remitente de pruebas `onboarding@resend.dev` en desarrollo. Resend solo permite enviar desde dominios verificados; pasar a dominio propio queda fuera de este spec.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Resend con remitente de pruebas solo entrega al correo dueño de la cuenta | Configurar `CONTACT_TO_EMAIL` con ese correo en desarrollo; verificar dominio en otro spec antes de producción |
| API key filtrada al bundle del cliente | Solo se lee en `app/acerca-de/actions.ts` (servidor), sin prefijo `NEXT_PUBLIC_`; criterio de aceptación comprueba `.next/static` |
| Bots usan la Server Action como relay de spam hacia el equipo | Honeypot + validación + límite de longitud; el destinatario es fijo (no lo controla el visitante). Rate limit queda para otro spec |
| Inyección de cabeceras vía nombre o correo | Quitar `\r` y `\n` de nombre y asunto; el destinatario no viene del formulario |
| Variables de entorno ausentes en despliegue | La acción comprueba que existan y devuelve `send_failed`; el formulario lo muestra como error inline sin romper la página |
| Los `@keyframes` del template (`shake`, `blink`) chocan con los de Tailwind v4 | Prefijo `av-` en cualquier animación nueva y comprobar `animation-name` con estilos computados (ver SPEC 02) |
| El dev server sirve CSS viejo tras editar `globals.css` | Borrar `.next` y reiniciar `npm run dev` antes de revisar |
| `cacheComponents` cambia la semántica de APIs de request | Leer la documentación de Next antes del paso 6; la acción no usa datos cacheados |

## What is **not** in this spec

- Correo de acuse al visitante.
- Rate limit, captcha o verificación de correo.
- Guardado de mensajes en base de datos o panel de administración.
- Plantillas de correo HTML y dominio propio verificado.
- Precarga del nombre desde la sesión mock.
- Validación automatizada con Playwright.
- GAMEPAD, variantes de tema `.gp-*` ni panel de tweaks.
- Cambios a los SPEC 01 y 02 como documentos.

Cada uno de estos puntos, si se aborda, va en su propio spec.
