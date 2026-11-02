# Juegos implementados

Juegos jugables en Arcade Vault (`PLAYABLE_GAME_IDS` en `lib/games.ts`). Todos se juegan en `/juegos/<id>/jugar`, se controlan solo con teclado (salvo el ratón en Arkanoid) y guardan la puntuación en el leaderboard al terminar la partida si hay sesión y la puntuación es mayor que 0.

| Juego      | ID           | Categoría | Canvas  | Vidas | Spec                                                | Motor                   |
| ---------- | ------------ | --------- | ------- | ----- | --------------------------------------------------- | ----------------------- |
| ASTEROIDS  | `asteroids`  | SHOOTER   | 800×600 | Sí    | [05-juego-asteroids](../specs/05-juego-asteroids.md)   | `lib/games/asteroids/`  |
| TETRIS     | `tetris`     | PUZZLE    | 300×600 | No    | [07-juego-tetris](../specs/07-juego-tetris.md)         | `lib/games/tetris/`     |
| ARKANOID   | `arkanoid`   | ARCADE    | 800×600 | Sí    | [08-juego-arkanoid](../specs/08-juego-arkanoid.md)     | `lib/games/arkanoid/`   |
| SERPENTINA | `serpentina` | ARCADE    | 800×600 | No    | [09-juego-serpentina](../specs/09-juego-serpentina.md) | `lib/games/serpentina/` |

Controles comunes: `P` / `Escape` pausan y `Espacio` reinicia en GAME OVER.

## ASTEROIDS

> Pulveriza asteroides en gravedad cero.

Portado de `references/02-asteroids`.

- **Controles:** `←` / `→` rotan, `↑` propulsa, `Espacio` dispara.
- **Reglas:** nave con inercia y mundo toroidal. 3 vidas, con 3 s de invencibilidad al reaparecer. Cada nivel trae `3 + nivel` asteroides. El powerup `3x` activa un disparo triple temporal.
- **Puntuación:** asteroide grande 20, mediano 50, pequeño 100. Los grandes se parten en dos medianos y los medianos en dos pequeños.

## TETRIS

> Encaja las piezas antes de que el techo te aplaste.

Portado de `references/03-tetris`. Antes se llamaba `caida` en el catálogo y conserva sus 10 puntuaciones semilla.

- **Controles:** `←` / `→` mueven, `↓` hace soft drop, `↑` o `X` rotan, `Espacio` hace hard drop.
- **Reglas:** la partida termina cuando la pieza nueva no cabe. El nivel sube cada 10 líneas y la caída se acelera según `max(100, 1000 − (nivel − 1) × 90)` ms. Muestra la pieza siguiente en un panel lateral y la sombra (ghost) de la pieza actual.
- **Puntuación:** 1, 2, 3 y 4 líneas suman 100, 300, 500 y 800 × nivel. El soft drop suma 1 punto por fila y el hard drop 2 por celda.

## ARKANOID

> Rebota la pelota y destruye muros de neón.

Portado de `references/04-arkanoid`. Antes se llamaba `bloque-buster` en el catálogo; sus semillas se borraron por ser inalcanzables.

- **Controles:** `←` / `→` o el ratón mueven la paleta.
- **Reglas:** 3 vidas y 5 niveles (pirámide, ajedrez, huecos, marco + cruz…), con la pelota cada vez más rápida. Completar el nivel 5 muestra `¡COMPLETASTE EL JUEGO!` y cuenta como fin de partida. Usa un spritesheet en `public/games/arkanoid/`.
- **Puntuación:** 10 por bloque. 208 bloques en total, máximo de 2 080 puntos.

## SERPENTINA

> Crece sin morder tu propia cola.

Juego nuevo (Snake clásico), sin assets: todo se dibuja en el canvas.

- **Controles:** flechas para girar.
- **Reglas:** rejilla de 40×30 celdas de 20 px. Las paredes se atraviesan; la partida termina al chocar con el propio cuerpo. El nivel sube cada 5 núcleos y el paso se acelera según `max(60, 150 − (nivel − 1) × 10)` ms. Llenar el tablero muestra `¡TABLERO COMPLETO!` y cuenta como fin de partida.
- **Puntuación:** `10 × nivel` por núcleo comido.

## Juegos del catálogo aún no jugables

`gloton`, `invasores`, `ranaria` y `duelo-pixel` existen en la tabla `games` y en la biblioteca con puntuaciones semilla, pero todavía no tienen motor.
