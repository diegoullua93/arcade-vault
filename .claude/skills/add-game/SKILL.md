---
name: add-game
description: Prepara el spec para añadir un juego jugable a Arcade Vault con su leaderboard (motor TS, registro, fila en `games`, guardado de score en GAME OVER). El juego puede portarse desde `references/` (tetris, arkanoid...) o crearse desde cero. Úsalo cuando el usuario pida "añadir / portar / crear un juego" para la plataforma.
disable-model-invocation: true
argument-hint: '<id> [carpeta en references/ | descripción del juego]'
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(git status:*), Bash(git log:*)
# Lee .agents/skills/spec/SKILL.md y template.md antes de redactar (ver paso 5)
---

# /add-game — Spec de un juego nuevo con leaderboard

## Session context

Fecha de hoy (úsala en la cabecera del spec, no la adivines):
!`date +%F`

Specs existentes (para calcular el siguiente número `NN`):
!`ls specs/ 2>/dev/null || echo "No existe specs/"`

Juegos con motor ya registrados:
!`grep -n "PLAYABLE_GAME_IDS" lib/games.ts`

Carpetas en `references/`:
!`ls references/ 2>/dev/null`

---

Este skill **no escribe código de la app**. Genera `specs/NN-juego-<id>.md` siguiendo el formato del skill `/spec` (que se lee antes de redactar, paso 5) y el patrón de los SPEC 05 (motor + pantalla) y 06 (catálogo + leaderboard). Después el usuario lo revisa, lo marca `approved` y lo implementa con `/spec-impl NN-juego-<id>`.

Responde en el idioma del usuario (el repo está en español).

## Flujo

### 1. Entrada

`$ARGUMENTS` = `<id> [fuente]`. Si falta algo, pregúntalo en **un solo bloque** con `AskUserQuestion`:

- `id` en kebab-case (p. ej. `tetris`). Debe coincidir con la fila de `games` si ya existe.
- Título, categoría (`ARCADE | PUZZLE | SHOOTER | VERSUS`) y color (`cyan | magenta | yellow | green`) solo si el juego **no** está ya en `games`.
- Fuente: carpeta de `references/` (port) o descripción (juego desde cero).
- Si el juego ya está en `PLAYABLE_GAME_IDS`, avisa y detente.

Para saber si el id ya está en el catálogo, léelo en `supabase/migrations/*_create_games.sql` (los 8 juegos iniciales; los 7 no jugables se *activan*, no se insertan) y en migraciones posteriores `*_add_game_*.sql`.

### 2. Contexto del proyecto

Lee, en este orden: `CLAUDE.md`, `specs/05-juego-asteroids.md`, `specs/06-leaderboard-y-tabla-games.md`, `lib/games/types.ts`, `lib/games.ts`, `components/game/game-screen.tsx`, `app/juegos/[id]/jugar/actions.ts`, la estructura de `lib/games/asteroids/` y `references/performance.md` (reglas de rendimiento que el motor debe cumplir). El estado real del código manda sobre lo que digan los specs.

### 3. Análisis de la fuente

- **Port:** lee `references/<carpeta>/CLAUDE.md`, `README.md`, `game.js` (y `levels.js`, `assets/`, `index.html`, `style.css` si existen). Rellena la tabla de análisis de `references/engine-contract.md` (§ Análisis de una fuente): globals, listeners, DOM/HUD propio, canvas(es), assets, reglas de puntuación, estados, niveles/vidas. Nunca modifiques `references/`.
- **Desde cero:** pregunta (bloque de 3-5 preguntas) reglas, controles, condición de GAME OVER, puntuación y si hay vidas/niveles.

### 4. Decisiones abiertas

Pregunta solo lo que no se pueda resolver con los patrones existentes. Siempre hay que cerrar:

- Tamaño interno del canvas (`GameScreen` hoy asume 800×600; ver `references/integration.md` § Canvas).
- Qué muestra el HUD si el juego no tiene vidas o niveles.
- Assets (sprites/sonido): copiarlos a `public/games/<id>/` o dejarlos fuera de alcance.
- Qué hacer con las filas `is_seed` del juego (conservar o borrar por migración).
- Si hay UI extra (p. ej. canvas "siguiente pieza" de Tetris).

### 5. Leer el skill `/spec` (obligatorio antes de escribir)

**Antes de crear cualquier archivo en `specs/`**, lee con `Read` estos dos archivos y tómalos como la referencia de cómo se redacta un spec en este repo:

1. `.agents/skills/spec/SKILL.md`
2. `.agents/skills/spec/template.md`

Si alguno no existe, avisa al usuario y detente (no improvises el formato). De ahí hereda este skill, sin reinterpretarlas:

- **Estructura y orden de secciones** (`template.md`): cabecera → *Por qué existe* (aquí siempre, porque el port rompe patrones) → *Scope* con **In** y **Out** obligatorios → *Data model* → *Implementation plan* → *Acceptance criteria* → *Decisions* → *Risks* → *What is not in this spec*.
- **Cabecera** en blockquote con `Status`, `Depends on`, `Date`, `Objective`; el objetivo cabe en **una sola frase**. Si no cabe, o el juego toca demasiadas áreas, propón dividir el spec antes de seguir (regla de «feature demasiado grande»).
- **Reglas de calidad**: cada paso del plan deja el sistema funcional y es commiteable por sí solo (si un paso pide más de 30-50 líneas, se divide); el último paso no es «probar todo»; criterios de aceptación booleanos y verificables (nada de «funciona bien»); *Decisions* con razón en cada una; nombres concretos de archivos y claves; sin TODOs; sin funciones completas en el spec, solo fragmentos para ilustrar estructuras.
- **Criterio de parada de preguntas**: antes de escribir debes poder responder sin suponer (1) qué archivos aparecen o cambian, (2) cuál es el primer y el último paso ejecutable y (3) cómo se verifica que está terminado. Si no, vuelve al paso 4 y pregunta.
- **Escritura directa**: si tienes toda la información, escribe el spec completo y guárdalo sin pedir confirmación sección por sección ni permiso para el nombre; solo se avanza sección a sección si falta información.
- **Guardado** (Fase 4 de `/spec`): usa la fecha de la sección *Session context* (nunca otra); estado `Draft` por defecto, escrito con la misma palabra que usan los specs existentes del repo (hoy `draft`/`approved`/`implemented` en minúsculas); nunca `Approved` automático; comprueba que cada spec listado en `Depends on` exista en `specs/`; si `specs/.spec-config.yml` no existe, créalo con el contenido por defecto de `/spec`, y si existe no lo toques; solo preguntas si el archivo destino ya existe.
- **Reglas duras**: no se escribe código, solo el `.md`; no se asumen decisiones que el usuario no confirmó; no se propone implementar tras guardar.

Si `/spec` y este skill difieren en forma o formato, manda `/spec`; este skill solo aporta el **contenido específico de juegos** (motor, integración, leaderboard).

### 6. Redactar y guardar el spec

1. Número `NN` = siguiente al mayor de `specs/`, con dos dígitos; nombre `NN-juego-<id>.md`.
2. Parte de `references/spec-template.md` (especialización para juegos del `template.md` de `/spec`) y rellénalo con lo analizado, respetando las reglas del paso 5. Mantén los mismos encabezados que los SPEC 05/06.
3. El *Implementation plan* debe ser de pasos commiteables, cada uno con su verificación, y cubrir siempre los puntos de `references/integration.md`.
4. Los criterios de aceptación comunes (build, hooks de teclado, guardado, sin efectos colaterales) vienen ya redactados en la plantilla; añade los específicos de jugabilidad del juego, derivados de sus reglas reales (puntuación, niveles, powerups...).
5. Guarda con `Write` en `specs/` siguiendo la Fase 4 de `/spec` descrita arriba.

### 7. Cierre

Resume en pocas líneas: ruta del spec, decisiones tomadas, riesgos principales y el siguiente paso: revisar, cambiar `Status` a `approved` y ejecutar `/spec-impl NN-juego-<id>`. Menciona si creaste `specs/.spec-config.yml`. Termina ahí: no propongas implementar.

## Reglas que todo spec generado debe imponer

- Leer `node_modules/next/dist/docs/` antes de escribir código de Next (versión 16.4, `cacheComponents`).
- `/frontend-design` para cualquier UI nueva (`CLAUDE.md`).
- Port sin cambiar reglas, números ni balance del original; constantes copiadas literalmente.
- Motor sin React/Next, estado en clausura, `destroy()` limpio (`references/engine-contract.md`).
- Rendimiento (`references/performance.md`): sin asignaciones por frame, lo estático en canvas fuera de pantalla y los criterios de la sección *Rendimiento* de la plantilla en el spec generado.
- No tocar `references/`, `lib/games/asteroids/` ni la lógica de `saveScore` salvo que el spec lo justifique.
- Validación manual + `tsc`, `lint`, `build` y `git grep`; el repo no tiene test runner.
- Un spec por juego: no portar dos juegos en el mismo spec.
