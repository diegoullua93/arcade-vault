# SPEC 02 — Pantalla Home (landing) de Arcade Vault

> **Status:** implemented
> **Depends on:** SPEC 01
> **Date:** 2026-10-20
> **Objective:** Implementar la landing `/` según `references/templates/home-about`, mover la Biblioteca a `/biblioteca` y validar el resultado con Playwright contra la referencia.

---

## Por qué existe este spec

En el SPEC 01 la Biblioteca ocupa `/`. El template nuevo define una pantalla `home` como entrada de la app y deja la Biblioteca como una ruta aparte. Este spec añade esa landing y reubica la Biblioteca, lo que toca código del SPEC 01 (rutas y enlaces).

Archivos de referencia en `references/templates/home-about/` (aquí los nombres sí coinciden con su contenido):

| Archivo | Contenido |
| --- | --- |
| `home.jsx` | Landing: hero, secciones 01–04, estadísticas y CTA final |
| `nav.jsx` | Nav con "Inicio" y "Acerca de" |
| `styles.css` | Tema completo (1744 líneas) |
| `about.jsx` | Acerca de + Contacto (fuera de este spec) |
| `arcade-vault-standalone.html` | Bundle completo; abre directo en la ruta `home`. Se usa como referencia visual |

## Scope

**In:**

- Ruta `/` con la landing, compuesta por:
  - Hero con 8 siluetas pixel flotantes, eyebrow "INSERTA UNA MONEDA_", título en 3 líneas, subtítulo, 2 CTAs e indicador "DESLIZA".
  - Sección `// 01` ¿POR QUÉ ARCADE VAULT? (4 tarjetas con icono pixel).
  - Sección `// 02` JUEGOS DISPONIBLES AHORA (6 mini-tarjetas + botón "VER TODOS LOS JUEGOS →").
  - Bloque de estadísticas (3 columnas).
  - Sección `// 03` ACTIVIDAD EN VIVO (últimas puntuaciones + top jugadores de hoy).
  - Sección `// 04` PRECIOS (plan único + 3 preguntas frecuentes).
  - CTA final "¿LISTO PARA JUGAR?".
- Animación de aparición al hacer scroll (`.reveal` → `.in`) con `IntersectionObserver`.
- Biblioteca movida de `/` a `/biblioteca` sin cambios visuales.
- Nav actualizado: "Inicio", "Biblioteca", "Salón de la Fama"; el logo apunta a `/`.
- Enlaces del SPEC 01 actualizados para apuntar a `/biblioteca` donde corresponda.
- CSS de las secciones HOME, ACTIVITY y PRICING del template añadido a `app/globals.css`.
- Textos ajustados a los juegos reales de `lib/games.ts` (ver Decisions).
- Validación con Playwright contra `arcade-vault-standalone.html` en 1440×900 y 390×844.

**Out of scope (para specs futuros):**

- Pantalla "Acerca de" y Contacto (`about.jsx`) y el enlace "Acerca de" en el Nav.
- Las ~470 líneas de GAMEPAD y variantes de tema (`.gp-*`) del `styles.css`: ningún componente de los templates las usa.
- Datos reales de actividad, top de jugadores o estadísticas; todo es mock fijo.
- Registro real: "CREAR CUENTA" y "EMPEZAR GRATIS" solo navegan a `/auth`.
- Pasarela de pago o planes: "PRECIOS" es solo contenido informativo.
- Editar el SPEC 01 (queda como histórico de lo implementado).

## Data model

Datos nuevos, constantes tipadas en `lib/home.ts`:

```ts
export type NeonColor = "cyan" | "magenta" | "yellow" | "green";

export type Feature = {
  icon: "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET";
  title: string;
  desc: string;
  color: NeonColor;
};

export type HomeStat = { n: string; u: string; s: string };

export type RecentScore = {
  player: string;
  game: string;       // título tal como se muestra, p. ej. "Caída"
  score: number;
  ago: string;        // texto fijo, p. ej. "hace 2 min"
  color: NeonColor;
};

export type TopPlayer = { rank: number; player: string; score: number };

export type FaqItem = { q: string; a: string };

export const FEATURES: Feature[];            // 4 elementos
export const STATS: HomeStat[];              // 3 elementos; el primero deriva de GAMES.length
export const RECENT_SCORES: RecentScore[];   // 7 elementos
export const TOP_PLAYERS: TopPlayer[];       // 5 elementos
export const PRICING_FEATURES: string[];     // 6 elementos
export const FAQ: FaqItem[];                 // 3 elementos
```

Convenciones:

- Los juegos de la sección `// 02` salen de `GAMES.slice(0, 6)` (`lib/games.ts`).
- Las puntuaciones se muestran con `toLocaleString("es-ES")`.
- Los datos de actividad usan solo nombres de juegos que existen en `GAMES`.
- No se usa `Date`, `Math.random` ni hora actual (evita hydration mismatch).

## Implementation plan

Antes de empezar: releer en `node_modules/next/dist/docs/` lo relativo a Server y Client Components y a rutas del App Router (ver `CLAUDE.md`).

1. **Mover la Biblioteca.** Crear `app/biblioteca/page.tsx` con el contenido actual de `app/page.tsx` (hero + `<Library />`). Dejar `app/page.tsx` con un placeholder mínimo. Verificar: `/biblioteca` se ve igual que antes.
2. **Actualizar Nav y enlaces.** En `components/nav.tsx`: añadir "Inicio" (activo solo en `/`), "Biblioteca" (activo en `/biblioteca` y `/juegos/*`), logo a `/`, y lo mismo en el panel móvil. Cambiar a `/biblioteca` el botón VOLVER de `app/juegos/[id]/page.tsx`, "VOLVER A LA BIBLIOTECA" de `components/hall-of-fame.tsx` y el `router.push` de `components/auth-form.tsx`. Verificar: ningún enlace lleva a una pantalla incorrecta.
3. **CSS de la landing.** Añadir a `app/globals.css` las secciones HOME PAGE, ACTIVITY y PRICING de `references/templates/home-about/styles.css`, incluidas `.reveal` y `.reveal.in`. Verificar con un diff que el resto del CSS base no cambió respecto al template. Verificar: `npm run build` pasa.
4. **Datos mock.** Crear `lib/home.ts` con las constantes y tipos del Data model, con los textos ajustados. Verificar: `npx tsc --noEmit` pasa.
5. **Reveal.** Crear `components/home/reveal.tsx` (Client Component con `IntersectionObserver`, umbral 0.12, que añade `in` una vez y deja de observar; hijos con `transitionDelay` escalonado donde el template lo define).
6. **Hero.** Crear `components/home/silhouettes.tsx` (8 SVG) y montar el hero en `app/page.tsx` con CTAs `<Link>`: EXPLORAR JUEGOS → `/biblioteca`, CREAR CUENTA → `/auth`.
7. **Secciones 01 y 02.** Crear `components/home/feature-icon.tsx` (4 iconos) y `components/home/mini-card.tsx` (enlace a `/juegos/[id]`). Montar las secciones con `<Reveal>`.
8. **Estadísticas y actividad.** Montar el bloque de estadísticas y la sección `// 03` (ticker y top con barras; "VER SALÓN →" → `/salon`).
9. **Precios y CTA final.** Montar la sección `// 04` y el CTA final (EMPEZAR GRATIS → `/auth`, INSERTAR MONEDA → `/biblioteca`).
10. **Validación con Playwright.** Servir `references/templates/home-about/` de forma estática, abrir `arcade-vault-standalone.html` y `http://localhost:3000/`, y comparar en 1440×900 y 390×844 (ver Acceptance criteria). Corregir las diferencias en `globals.css` o los componentes. Borrar capturas y `.playwright-mcp` al terminar.

## Acceptance criteria

**Rutas y navegación**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores y generan `/` y `/biblioteca`.
- [ ] `/` muestra el hero con el título "EL ARCADE CLÁSICO ESTÁ DE VUELTA" y `/biblioteca` muestra el hero "ARCADE VAULT" con 8 tarjetas.
- [ ] El Nav muestra "Inicio", "Biblioteca" y "Salón de la Fama", y no muestra "Acerca de".
- [ ] "Inicio" está activo en `/`; "Biblioteca" está activo en `/biblioteca` y en `/juegos/caida`.
- [ ] Pulsar el logo desde cualquier pantalla navega a `/`.
- [ ] Enviar el formulario de `/auth` o pulsar "Jugar como invitado" redirige a `/biblioteca`.
- [ ] El botón VOLVER del detalle y "VOLVER A LA BIBLIOTECA" del salón navegan a `/biblioteca`.

**Contenido y enlaces de la landing**

- [ ] EXPLORAR JUEGOS, "VER TODOS LOS JUEGOS →" e INSERTAR MONEDA navegan a `/biblioteca`.
- [ ] CREAR CUENTA y EMPEZAR GRATIS navegan a `/auth`.
- [ ] Cada una de las 6 mini-tarjetas navega a `/juegos/<id>` del juego correspondiente.
- [ ] "VER SALÓN →" navega a `/salon`.
- [ ] La landing contiene 4 tarjetas de "¿POR QUÉ ARCADE VAULT?", 3 bloques de estadísticas, 7 filas de últimas puntuaciones, 5 filas de top jugadores, 6 puntos de lista de precios y 3 preguntas frecuentes.
- [ ] El texto de la primera tarjeta menciona "Bloque Buster, Caída, Serpentina" y no menciona "Arkanoid", "Tetris" ni "Snake".
- [ ] El primer bloque de estadísticas muestra el número de juegos de `GAMES` (8) y no "12+".
- [ ] Todos los juegos citados en "ÚLTIMAS PUNTUACIONES" existen en `lib/games.ts`.

**Animación y accesibilidad**

- [ ] Al cargar, las secciones fuera de pantalla tienen opacidad 0, y al hacer scroll hasta ellas pasan a tener la clase `in` y opacidad 1.
- [ ] Con `prefers-reduced-motion: reduce` las secciones se muestran sin animación de entrada.
- [ ] La consola del navegador no muestra errores de hidratación en `/`.

**Validación con Playwright (contra `arcade-vault-standalone.html`)**

- [ ] A 1440×900, tras forzar la clase `in` en todos los `.reveal`, la altura total del documento de la app es igual a la de la referencia (±2 px), descontando las diferencias de texto listadas en Decisions.
- [ ] A 1440×900 y a 390×844, `x`, `y`, ancho y alto de `.av-nav`, `.home-hero`, `.home-title`, `.home-ctas`, `.feature-card` (las 4), `.mini-card` (las 6), `.stats-inner`, `.activity-card` (las 2), `.price-card`, `.faq-item` (las 3) y `.home-final` coinciden con los de la referencia (±1 px).
- [ ] A 390×844 el documento no tiene desbordamiento horizontal propio de la landing: `document.documentElement.scrollWidth` es igual al de la referencia.
- [ ] Una revisión visual de las capturas de página completa (referencia y app) a 1440×900 y a 390×844 no muestra diferencias de color, tipografía ni disposición, salvo las de Decisions.
- [ ] No quedan capturas ni la carpeta `.playwright-mcp` en el repo al terminar.

## Decisions

- **Sí:** Home en `/` y Biblioteca en `/biblioteca`, como el template. Aunque toca código del SPEC 01, mantiene una sola fuente de verdad de rutas.
- **No:** Home en `/inicio` con la Biblioteca en `/`. No rompía nada, pero la landing dejaba de ser la entrada y se alejaba del template.
- **Sí:** el login y el modo invitado redirigen a `/biblioteca`, como el `App` del template.
- **Sí:** solo Home y Nav actualizado. "Acerca de" y Contacto van en otro spec, y por eso el Nav no incluye ese enlace (evita un link roto).
- **Sí:** pasar a `globals.css` solo HOME, ACTIVITY y PRICING. GAMEPAD y variantes `.gp-*` son código muerto para estas pantallas.
- **Sí:** textos ajustados a nuestros juegos. Diferencias respecto al template, y únicas permitidas en la validación:
  - La tarjeta "JUEGOS CLÁSICOS" cita "Bloque Buster, Caída, Serpentina y muchos más" en lugar de "Arkanoid, Tetris, Snake y muchos más".
  - La primera estadística muestra `GAMES.length` ("8") en lugar de "12+"; el subtítulo "Y CONTANDO" se conserva.
  - Nav sin "Acerca de" y con las rutas reales.
- **No:** copiar literal los textos con marcas de otros juegos y "12+". Se prefirió coherencia con el catálogo real aunque complique un poco la comparación.
- **Sí:** datos de actividad y top como constantes fijas en `lib/home.ts`. Son deterministas y se sustituyen luego por datos reales.
- **Sí:** `Reveal` como único Client Component nuevo del landing; el resto son Server Components.
- **Sí:** los CTAs son `<Link>` con clase `btn`, no `<button>` con `onClick`. HTML válido y prefetch.
- **Sí:** referencia de Playwright = `arcade-vault-standalone.html` servido estáticamente. Ya se comprobó que abre en la ruta `home` y renderiza el landing completo.
- **No:** reconstruir un `index.html` con los `.jsx` sueltos. En `home-about` falta el `App` y los datos, y la reconstrucción añade trabajo sin ganar fidelidad.
- **Sí:** comparar posiciones y tamaños con `getBoundingClientRect` además de capturas, porque las animaciones (siluetas flotantes, ticker, `pulse`) hacen que los píxeles no sean reproducibles.
- **Sí:** tras terminar el plan, `app/page.tsx` se refactorizó a un componente por sección en `components/home/` (`hero-section`, `why-section`, `games-section`, `stats-section`, `activity-section`, `pricing-section`, `final-cta-section`) más `section-head` para el encabezado compartido. Cada sección importa sus propios datos de `lib/`. Se pidió fuera del plan original; se verificó que el HTML renderizado de `<main>` es idéntico antes y después.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Mover la Biblioteca deja enlaces rotos a `/` | El paso 2 lista cada enlace afectado y los criterios de aceptación los verifican uno por uno |
| `.reveal` oculta el contenido (opacidad 0) si el JS no carga o falla | Aceptado para el MVP; el contenido se revela al hidratar. Con `prefers-reduced-motion` se muestra sin animación |
| Capturas no reproducibles por animaciones continuas | Comparar rectángulos y, para las capturas, forzar `in` en `.reveal` y revisar visualmente |
| Diferencias de render entre el CSS del template y Tailwind v4 (ocurrió en el SPEC 01: padding del `input`, fuentes de respaldo de `next/font`) | Usar los nombres literales de fuente ya definidos en `globals.css` y revisar con Playwright inputs, botones y glifos especiales (▶, ✦, ▼, ✔) |
| Los `@keyframes` del template chocan con los de Tailwind v4 (`pulse` y `bounce`), que se emiten sin capa y ganan sobre los de `@layer components`: los botones `.pulse` animaban `opacity` en vez de `box-shadow` | Se renombraron a `av-pulse` y `av-bounce`. Usar el prefijo `av-` en cualquier animación nueva y comprobar con estilos computados que `animation-name` es el esperado |
| El dev server sirve CSS viejo tras editar `globals.css` | Borrar `.next` y reiniciar `npm run dev` antes de validar |
| El bundle standalone tarda en descomprimir | Esperar a que aparezca `.home` en el DOM antes de medir |

## What is **not** in this spec

- Pantalla "Acerca de", formulario de contacto o su enlace en el Nav.
- GAMEPAD, variantes de tema `.gp-*` ni panel de tweaks.
- Datos reales de actividad, ranking o estadísticas.
- Registro, planes o pagos reales.
- Nuevos juegos o cambios al catálogo de `lib/games.ts`.
- Cambios al SPEC 01 como documento.

Cada uno de estos puntos, si se aborda, va en su propio spec.
