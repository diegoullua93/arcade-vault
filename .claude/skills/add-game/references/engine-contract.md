# Contrato del motor de un juego

Patrón fijado por SPEC 05 (`lib/games/asteroids/`). Un juego nuevo lo repite.

## Estructura

```
lib/games/<id>/
  constants.ts   # tamaños, velocidades, puntos... copiados literalmente de la fuente
  utils.ts       # helpers puros (si hacen falta)
  entities.ts    # clases/funciones de entidades; reciben ctx e input por parámetro
  game.ts        # createXGame(canvas, callbacks): GameInstance
```

Los tipos compartidos están en `lib/games/types.ts` (`GameStatus`, `GameHud`, `GameCallbacks`, `GameInstance`). No se modifican salvo extensión justificada en el spec (y entonces no debe romper Asteroids).

## Reglas

- Sin imports de `react` ni `next/*`. Sin `let`/`var` a nivel de módulo (`git grep -nE "^let |^var " -- lib/games` vacío). Todo el estado vive en la clausura de `createXGame`; dos instancias no comparten nada.
- `createXGame(canvas, { onHudChange })` devuelve `{ pause, resume, restart, destroy }`.
- `destroy()` cancela `requestAnimationFrame` y retira **cada** listener con la misma referencia con la que se añadió (React 19 ejecuta el efecto dos veces en desarrollo).
- Loop con `requestAnimationFrame`; `dt` limitado a 50 ms; al reanudar se reinicia `lastTime` para que el primer `dt` sea 0.
- `Math.random` y `performance.now` solo dentro del motor, nunca en el render de React.
- `onHudChange({ score, lives, level, status })` solo cuando cambia algún campo (comparar con el último emitido). `status`: `playing | dead | gameover | paused`.
- **La transición a `status === "gameover"` es lo que hace que `GameScreen` llame a `saveScore`** con `score`. El motor no sabe nada de Supabase, sesión ni guardado. Puntuación 0 no se guarda.
- Juegos sin vidas o niveles: emitir valores fijos (`lives: 0`/`level: 1`) y documentar en el spec cómo se muestran en el HUD.
- `restart()` rearma el estado completo; `Espacio` reinicia en `gameover` si el juego lo permite.
- Teclado: `preventDefault` sobre flechas y Espacio mientras esté montado; `P`/`Escape` alternan pausa; pausa automática en `blur` de la ventana y `visibilitychange`. El estado `paused` recuerda el previo (`playing`/`dead`) y vuelve a él al reanudar.
- Overlays dentro del canvas: `PAUSA` y `GAME OVER` (con puntaje). El resto del HUD es React.
- El canvas mantiene su resolución interna; el escalado es solo CSS.

## De referencia JS a motor TS

| En la referencia                                  | En el motor                                                                |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| Variables globales / `'use strict'` sin módulos   | Estado en la clausura de `createXGame`                                     |
| `document.getElementById("canvas")`               | Recibir `canvas` por parámetro                                             |
| HUD en el DOM (`#score`, `#lines`...)             | `onHudChange`; el HUD lo pinta `GameScreen`                                |
| Overlays HTML (`#overlay`)                        | Dibujar en canvas (`PAUSA`, `GAME OVER`)                                   |
| `addEventListener` sin `remove`                   | Referencias nombradas y `removeEventListener` en `destroy()`               |
| `index.html`, `style.css`, `.gitignore`, `.DS_Store`, `__MACOSX` | No se portan                                                |
| Spritesheet / mp3 / `levels.js`                   | Datos a `constants.ts`/`levels.ts`; binarios a `public/games/<id>/` y carga dentro del motor |
| Sonido/música                                     | Fuera de alcance salvo petición explícita                                  |
| `localStorage` de récords                         | No se porta; el récord es el leaderboard de Supabase                       |
| Dos canvas (Tetris: tablero + siguiente pieza)    | Decidir en el spec: segundo canvas opcional gestionado por el motor, o solo tablero |

## Análisis de una fuente (rellenar en el spec)

| Aspecto               | Anotar                                                       |
| --------------------- | ------------------------------------------------------------ |
| Archivos útiles       | `game.js`, `levels.js`, `assets/`... y líneas aprox.         |
| Globals y listeners   | Los que hay que meter en la clausura / retirar en `destroy`  |
| Canvas                | Tamaño(s) interno(s)                                         |
| HUD y overlays        | Qué pasa a React y qué se dibuja en canvas                   |
| Puntuación            | Tabla de puntos / fórmula; máximo plausible                  |
| Estados               | Inicio, pausa, vidas, GAME OVER, victoria, niveles           |
| Controles             | Teclas originales                                            |
| Assets                | Imágenes, sonidos                                            |
| Discrepancias         | Texto del catálogo (`long`) vs reglas reales                 |

## Notas por referencia conocida

- **`03-tetris`** (`game.js` ~305 líneas): tablero 10×20, `BLOCK` 30 px (300×600), canvas "siguiente" 120×120; `LINE_SCORES = [0,100,300,500,800] × level`, hard drop +2/celda, soft drop +1/fila, `dropInterval = max(100, 1000 − (level−1)·90)`, nivel = `floor(lines/10)+1`, wall kicks `[0,±1,±2]`, ghost a `globalAlpha 0.2`. No tiene vidas: HUD con `lives` fijo o líneas en su lugar (decidir). Canvas distinto de 800×600.
- **`04-arkanoid`**: canvas 800×600, `levels.js` con 5 niveles y `ballSpeedMultiplier`, `assets/spritesheet.js` + png, 2 mp3. Tiene vidas y niveles.
- **`02-asteroids`**: ya portado (SPEC 05).
