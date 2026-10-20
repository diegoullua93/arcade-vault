# SPEC 01 — MVP visual de Arcade Vault (todas las pantallas)

> **Status:** implementado
> **Depends on:** Ninguna
> **Date:** 2026-10-16
> **Objective:** Portar a Next.js (App Router) todas las pantallas de `references/templates` con datos mock y sin implementar ningún juego.

---

## Por qué existe este spec

El repo es el scaffold sin tocar de `create-next-app`. Los templates de `references/templates` son un prototipo en React UMD + Babel con navegación por hash. Este spec los convierte en la base real de la app (rutas, componentes, estilos y datos tipados) para que los specs posteriores (juegos, auth real, ranking real) tengan dónde enchufarse.

Nota: en `references/templates` los nombres de archivo están cruzados con su contenido. Mapa real:

| Archivo | Contenido real |
| --- | --- |
| `app.jsx` | HTML de entrada (carga fuentes y scripts) |
| `nav.jsx` | `App` (estado de ruta y usuario, footer) |
| `auth.jsx` | `Nav` (barra y menú móvil) |
| `biblioteca.jsx` | `data.jsx`: `GAMES`, `CATS`, `seededScores` |
| `detalle.jsx` | `Auth` |
| `salon.jsx` | `GamePlayer` (reproductor) |
| `data.jsx` | CSS del tema completo (950 líneas) |
| `Arcade Vault.html` | `GameCard` y `Library` |
| `styles.css` | `HallOfFame` |

No existe componente de la pantalla de detalle; solo hay CSS (`.av-detail`, `.detail-cover`, `.detail-info`, `.stat-strip`, `.leaderboard`, `.lb-row`).

## Scope

**In:**

- Rutas reales del App Router:
  - `/` — Biblioteca (hero, búsqueda, chips de categoría, grilla de tarjetas, estado "sin resultados").
  - `/juegos/[id]` — Detalle del juego (diseñada desde el CSS existente).
  - `/juegos/[id]/jugar` — Reproductor con marco CRT y placeholder estático.
  - `/auth` — Iniciar sesión / Crear cuenta / Jugar como invitado.
  - `/salon` — Salón de la Fama (tabs por juego, podio, tabla, fila "tu mejor marca").
- Layout global: fondo (`av-bg`, `av-noise`), Nav sticky con menú móvil, footer.
- Tema neón oscuro único copiado tal cual del template a `app/globals.css`.
- Fuentes Press Start 2P y JetBrains Mono vía `next/font/google`, reemplazando Geist.
- Datos mock tipados en `lib/games.ts` y `lib/scores.ts`.
- Sesión mock en `localStorage` (clave `av_user`) compartida por el Nav, el Salón y el Reproductor.
- UI en español, `<html lang="es">`, metadata `Arcade Vault · Portal Retro`.
- Responsive según los breakpoints del CSS del template (840px, 900px, 720px).

**Out of scope (para specs futuros):**

- Cualquier juego jugable. El reproductor es solo un marco.
- Puntuación simulada, pausa, fin de partida y modal "guardar puntuación" del template (`av_scores`).
- Autenticación real, backend, base de datos, OAuth (los botones Google y GitHub son decorativos).
- Ranking real; los scores son mock deterministas.
- Contador de créditos funcional (`CRÉDITOS · 03` es texto fijo).
- i18n, modo claro, tests automatizados.

## Data model

Datos nuevos, solo en el cliente o como constantes:

```ts
// lib/games.ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string;            // slug, p. ej. "bloque-buster"
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;         // clase CSS de portada, p. ej. "cover-bricks"
  color: GameColor;
  best: number;
  plays: string;         // ya formateado, p. ej. "12.4K"
};

export const GAMES: Game[];                       // los 8 juegos de data.jsx
export const CATS: ("TODOS" | GameCategory)[];
export function getGame(id: string): Game | undefined;

// lib/scores.ts
export type ScoreRow = { rank: number; name: string; score: number; date: string };
export function seededScores(seed: number, count?: number): ScoreRow[]; // misma lógica que el template

// Sesión mock (components/session-provider.tsx)
export type SessionUser = { name: string }; // localStorage "av_user", JSON; null = invitado
```

Convenciones:

- Los 8 juegos conservan los `id` del template: `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`.
- Números en formato `es-ES` con `toLocaleString("es-ES")`.
- La sesión se lee de `localStorage` solo tras el montaje (no en el render del servidor) para evitar hydration mismatch.

## Implementation plan

Antes de empezar: leer en `node_modules/next/dist/docs/` las guías de layouts/páginas, rutas dinámicas (`params` asíncronos), `next/font`, `cacheComponents` y Client Components (ver `CLAUDE.md`).

1. **Tema y layout base.** Copiar el CSS de `references/templates/data.jsx` (el archivo que realmente contiene el tema) a `app/globals.css` tras `@import "tailwindcss"`; eliminar el modo claro y los estilos del scaffold. En `app/layout.tsx`: fuentes Press Start 2P y JetBrains Mono con `next/font` enlazadas a `--pixel` y `--mono`, `lang="es"`, metadata nueva, `av-bg` y `av-noise`. Verificar: `npm run dev` muestra fondo neón vacío sin errores.
2. **Datos mock.** Crear `lib/games.ts` y `lib/scores.ts` portando `GAMES`, `CATS`, `getGame` y `seededScores`. Verificar: `npm run lint` pasa.
3. **Sesión mock.** Crear `components/session-provider.tsx` (Client Component con contexto: `user`, `login(user | null)`, `signOut()`, persistencia en `av_user`) y montarlo en el layout.
4. **Nav y footer.** Crear `components/nav.tsx` (logo, links con estado activo por `usePathname`, contador fijo, botón de sesión, hamburguesa y panel móvil) y `components/footer.tsx`. Montarlos en el layout. Verificar: los links cambian de ruta y el menú móvil abre y cierra.
5. **Biblioteca (`/`).** Crear `components/game-card.tsx` (tilt con mouse, navega a `/juegos/[id]`) y `components/library.tsx` (búsqueda por título + chips, estado vacío). Reemplazar `app/page.tsx`.
6. **Detalle (`/juegos/[id]`).** Crear `app/juegos/[id]/page.tsx` (Server Component, `generateStaticParams` con los 8 ids, `notFound()` si el id no existe) usando `.av-detail`: portada, título, tags, descripción larga, `stat-strip` (mejor puntuación, partidas, categoría), botón JUGAR hacia `/juegos/[id]/jugar`, botón volver y leaderboard top 10 con `seededScores`.
7. **Reproductor (`/juegos/[id]/jugar`).** Crear `app/juegos/[id]/jugar/page.tsx`: HUD estático (jugador desde sesión o `INVITADO`, puntuación `0`, vidas `3`, nivel `01`), marco `.crt` con pantalla que muestra un mensaje "JUEGO PRÓXIMAMENTE", barra inferior `SEÑAL OK · {título} · CRT-83 · 60 HZ` y botón SALIR hacia el detalle.
8. **Auth (`/auth`).** Crear `app/auth/page.tsx` y `components/auth-form.tsx`: tabs entrar/crear (campo correo solo en crear), submit llama `login({ name: usuario.toUpperCase().slice(0, 10) || "PLAYER1" })` y redirige a `/`; "Jugar como invitado" llama `login(null)` y redirige a `/`; botones sociales decorativos.
9. **Salón de la Fama (`/salon`).** Crear `app/salon/page.tsx` y `components/hall-of-fame.tsx`: tabs por juego, podio 2-1-3, tabla de 12 filas con animación escalonada, fila "tu mejor marca" si hay sesión (derivada como en el template), botón volver a la biblioteca.
10. **Limpieza.** Quitar restos del scaffold (assets e imports sin uso) y confirmar que `npm run lint` y `npm run build` pasan.

## Acceptance criteria

- [ ] `npm run lint` termina sin errores ni warnings.
- [ ] `npm run build` termina sin errores y genera las rutas `/`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/auth` y `/salon`.
- [ ] `/` muestra el hero "ARCADE VAULT" y 8 tarjetas de juego.
- [ ] Escribir "caida" en el buscador deja solo la tarjeta CAÍDA; escribir "zzz" muestra "NO HAY RESULTADOS".
- [ ] Pulsar el chip PUZZLE muestra solo 1 juego; pulsar TODOS vuelve a mostrar 8.
- [ ] Pulsar una tarjeta o su botón JUGAR navega a `/juegos/<id>` de ese juego.
- [ ] `/juegos/inexistente` y `/juegos/inexistente/jugar` devuelven la página 404.
- [ ] `/juegos/caida` muestra título, categoría, descripción larga, 3 estadísticas y un leaderboard de 10 filas con las 3 primeras con colores oro, plata y bronce.
- [ ] El botón JUGAR del detalle navega a `/juegos/caida/jugar`, que muestra el marco CRT con el texto "JUEGO PRÓXIMAMENTE" y no contiene ningún juego ni puntuación cambiante.
- [ ] SALIR en el reproductor vuelve a `/juegos/<id>`.
- [ ] En `/auth` la pestaña "CREAR CUENTA" muestra el campo de correo y "INICIAR SESIÓN" lo oculta.
- [ ] Enviar el formulario con usuario `neonfox` redirige a `/` y el Nav muestra `NEONFOX ▾`; recargar la página mantiene ese estado.
- [ ] Pulsar `NEONFOX ▾` cierra la sesión y el Nav vuelve a mostrar "Iniciar Sesión".
- [ ] "Jugar como invitado" redirige a `/` y el Nav muestra "Iniciar Sesión".
- [ ] `/salon` muestra podio de 3 puestos, tabla de 12 filas y cambia el ranking al elegir otra pestaña de juego.
- [ ] En `/salon` con sesión iniciada aparece la fila amarilla "TU MEJOR MARCA EN <juego>"; sin sesión no aparece.
- [ ] En un ancho de 390px se oculta la lista de links del Nav, aparece la hamburguesa y el panel lateral abre y cierra al pulsar el fondo.
- [ ] La consola del navegador no muestra errores de hidratación en ninguna de las 5 rutas.
- [ ] El link activo del Nav se resalta: "Biblioteca" en `/`, `/juegos/*`; "Salón de la Fama" en `/salon`.

## Decisions

- **Sí:** rutas reales del App Router. URLs compartibles y encaja con `cacheComponents`.
- **No:** navegación por hash con estado de ruta del template. Va contra el modelo de Next.
- **Sí:** construir el detalle desde el CSS existente. El template ya define su aspecto; falta solo el componente.
- **Sí:** reproductor reducido a marco CRT con placeholder estático. Sin juegos, la puntuación simulada, la pausa y el modal confunden; quedan para el spec de juegos.
- **No:** `PAUSA`, `FIN` ni guardado de puntuación en `av_scores`. Dependen de un juego real.
- **Sí:** sesión mock en `localStorage` (`av_user`). Mantiene los estados "con sesión" y "invitado" visibles en Nav, Salón y Reproductor.
- **No:** auth real. Va en un spec propio con backend.
- **Sí:** copiar el CSS tal cual a `globals.css`. Máxima fidelidad (clip-path, portadas CSS, animaciones) con mínimo riesgo.
- **No:** reescritura a utilidades Tailwind. Más trabajo y riesgo de divergir del diseño.
- **Sí:** tema oscuro único y fuentes del template vía `next/font`. El diseño es retro-oscuro por definición; se descarta Geist y `prefers-color-scheme`.
- **Sí:** datos mock en `lib/games.ts` y `lib/scores.ts`, con `seededScores` determinista. Se reemplazan luego por DB/API y evitan hydration mismatch.
- **Sí:** UI en español, sin i18n. Igual que el template y el README.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Next 16.4 con `cacheComponents` cambia la semántica de params, caché y APIs de request | Leer `node_modules/next/dist/docs/` antes de cada paso; los params se tratan como asíncronos |
| Leer `localStorage` en el render provoca hydration mismatch | Leerlo solo tras el montaje y renderizar el estado de invitado hasta entonces |
| CSS de 950 líneas puede chocar con el preflight de Tailwind v4 | Revisar visualmente cada pantalla frente al template en el paso correspondiente |
| `localStorage` bloqueado (modo privado) | Envolver lecturas y escrituras en `try/catch`; la app funciona como invitado |
| Nombres de archivo cruzados en `references/templates` | Usar el mapa de este spec en lugar de los nombres de archivo |

## What is **not** in this spec

- Ningún juego, ni siquiera uno de prueba.
- Puntuación en vivo, pausa, fin de partida o guardado de puntuaciones.
- Autenticación real, OAuth, backend o base de datos.
- Ranking real, créditos funcionales o perfiles de usuario.
- i18n, modo claro o tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propio spec.
