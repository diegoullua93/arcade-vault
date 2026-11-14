# Guía de rendimiento de un juego

Fijada por SPEC 11 a partir de medir los cuatro motores (Asteroids, Tetris, Arkanoid, Serpentina) en sus skins. Todo lo que sigue está comprobado en el navegador; lo que se probó y **no** ayudó está marcado como tal. La guía la cumplen el motor (`lib/games/<id>/`) y la capa React (`components/game/`).

## 1. Dónde está el coste

A velocidad normal el navegador limita todos los juegos a vsync (16,7 ms por frame): no se ve nada. El coste real aparece con la CPU limitada **20×** (CDP `Emulation.setCPUThrottlingRate`); con 4× tampoco se distingue. A 20× un juego simple cuesta ≈ 72 ms por frame, repartidos así (Serpentina, medido):

| Parte                                               | ms/frame a 20× |
| --------------------------------------------------- | -------------- |
| Suelo del navegador (vsync)                         | ≈ 17,5         |
| Efectos CSS de fondo de la página (`.av-bg`, ruido) | ≈ 27          |
| Motor (bucle + dibujo)                              | ≈ 28           |

Los efectos CSS de la página son globales y están fuera del alcance de un juego: no se tocan al añadir uno. Lo que sí controla un juego es la tercera fila.

## 2. Reglas del motor

Cada regla lleva la razón medida. Si una regla no aplica al juego, se anota en el spec.

### 2.1 Nada de asignaciones por frame

En el camino caliente (`update`, `draw`, colisiones):

- **Sin `forEach`/`map`/`filter`/`concat` ni spread** que creen closures o arrays en cada frame. Se usan bucles `for` con índice y, para quitar entidades muertas, un compactado en el sitio que conserva el orden:

  ```ts
  function compact(list: { dead: boolean }[]) {
    let kept = 0;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (!item.dead) list[kept++] = item;
    }
    list.length = kept;
  }
  ```

- **Sin objetos temporales por frame**: los rectángulos sucios van en un array plano `[x, y, w, h, ...]` reutilizado; los asteroides nacidos de una división, en un array de la clausura que se vacía con `length = 0`.
- **`emitHud` no asigna salvo que algo cambie**: se compara cada campo con el último emitido y el objeto `GameHud` solo se crea al cambiar.
- **Distancias con el cuadrado**, no con `Math.hypot` (lento en V8): `dx*dx + dy*dy < r*r`. Medido: junto con lo anterior, Asteroids pasó de ≈ 80 a ≈ 39 ms por frame a 20×.

### 2.2 Cachear lo estático

- El fondo estático, los sprites, los degradados y todo lo que lleve `shadowBlur` se dibujan **una vez** en un canvas fuera de pantalla (en la creación del skin, nunca por frame) y el frame solo llama a `drawImage`.
- Cada skin tiene su propia caché y se crea una instancia por motor (`getSkin(id)`).

### 2.3 Capa del tablero asentado

Cuando una parte grande de la escena solo cambia con un evento (una pieza que se fija, un bloque que se rompe), se pinta en un canvas fuera de pantalla y cada frame la copia:

- Un contador (`boardVersion`, `blocksVersion`) sube cada vez que esa parte cambia; la capa se repinta solo si `layerVersion !== version`.
- Se repinta con **las mismas llamadas y en el mismo orden** que antes (`skin.drawBackground(layer)` y luego las entidades), así que la copia es exacta si el contenido es opaco y las funciones de dibujo son puras (sin estado ni tiempo).
- Medido: Tetris pasó de 72–89 ms a 25–30 ms por frame; Arkanoid, de 119–126 ms a 39–55 ms.

### 2.4 Saltar los frames sin cambios

Si el estado visible no cambió, no se pinta y el canvas conserva el frame anterior (`needsDraw()`):

- Se compara pieza/posición/estado/versión con lo último que se pintó, más `forceDraw` en el arranque, al reanudar y al reiniciar.
- Los skins con efectos animados exponen `isAnimating?: () => boolean`. **Si falta, el motor asume que sí y repinta siempre** (un skin nuevo funciona sin tocar nada). Cuando `isAnimating` pasa a falso, el motor pinta **un frame más** para borrar el efecto.
- Solo sirve si la escena es casi estática (Tetris). Con una pelota o una nave moviéndose cada frame no hay frames que saltar.

### 2.5 Repintado parcial

Si la escena es estática salvo unas pocas zonas animadas (Serpentina: la moneda y los destellos), se repinta todo solo cuando cambia lo principal y entre medias solo esas zonas:

- Por zona: `drawImage` del fondo cacheado (sub-rectángulo 1:1) y después, bajo `ctx.clip()` de la unión de zonas, las entidades. Las zonas del frame anterior y del actual se restauran, para borrar el rastro.
- Rectángulos con **entero y recorte al lienzo** (`floor`/`ceil`, `max`/`min`) y con margen por contornos y destellos (comprobado: ±2 px en una celda, ~±44 px en un texto flotante).
- Con superposición (`overlay` de pausa o `gameover`) se siguen haciendo repintados completos: debajo puede haber animación.

### 2.6 Lo que se probó y NO ayuda

- **Un solo trazo para todos los asteroides y todas las balas** (`beginPath` + N `tracePath` + un `stroke`/`fill`): no es más rápido (a 20 asteroides tardó 2,65 ms frente a 2,0–2,1 ms uno a uno) y cambia los píxeles de los bordes (hasta ~190 niveles donde se cruzan trazos; hasta 55 en puntos de 2 px). No se usa.
- **Memoizar con `useCallback`/`useMemo`** en la pantalla de juego: la medición no lo justificó (no hay renders por frame). No se añade sin medir.

## 3. Reglas de la capa React

- **El motor se crea una vez.** El efecto que lo crea depende de `gameId` y de la vista (`skin`), y espera a `useHydrated()`: durante la hidratación `useSkin` devuelve el valor por defecto y, sin esa espera, se construye y destruye un motor con la vista equivocada en cada recarga.
- **`onHudChange` solo cuando cambia un campo** (regla del motor, §2.1): React re-renderiza por eventos (puntuación, nivel, estado), nunca por frame. Un dato por frame (p. ej. el contador `3x 2.5s` de Asteroids) se dibuja en el canvas, no en React.
- **Canvas auxiliares por evento**, no por frame: el canvas de «siguiente pieza» se dibuja desde `onNextChange` (una vez por pieza nueva), sin estado de React.
- **Limpieza completa**: tras SALIR no deben quedar listeners de `keydown`/`keyup`/`blur`/`visibilitychange` del juego, ni `requestAnimationFrame` pendientes, ni intervalos.

## 4. Cómo comprobar que un cambio de dibujo no cambia el aspecto

Un chequeo **temporal** dentro del motor (se retira antes de cerrar; `git grep TEMP-CHECK` debe quedar vacío):

1. Tras decidir y pintar el frame, leer el canvas (`getImageData`) → `a`.
2. Repintar **en el mismo canvas** con el método completo antiguo → `b`; comparar y contar canales con diferencia > 16 (el redondeo de antialiasing da ≤ 16).
3. Restaurar `a` con `putImageData`, para que los frames saltados se comprueben de verdad.

Trampas encontradas:

- Comparar contra un **segundo canvas** da falsos positivos (otra ruta de rasterizado). Comparar en el mismo canvas.
- Las lecturas con `getImageData` pasan el canvas de GPU a CPU a mitad de la prueba: forzar un repintado completo pasada la conmutación (≈ frame 45) y contar solo desde ahí.
- Inyectar los efectos de prueba **antes** de decidir/pintar el frame, no después.
- Medir también el ruido de base (dos repintados completos seguidos) para saber qué es renderizador y qué es un error.

Criterio: **0 diferencias > 16** en cada skin, con efectos, pausa/reanudar y `gameover` incluidos.

## 5. Cómo medir antes y después

Con Playwright MCP, sobre el **build de producción** (`npm run build` y `npx next start -p <puerto>`; no `next dev`: añade Strict Mode y HMR). La primera ejecución de `next build` puede detenerse en un aviso de seguridad de Next; se repite el mismo comando.

- Por juego y skin: 3 repeticiones de 10 s, recargando y esperando 1,5 s, con `HeapProfiler.collectGarbage` antes y la CPU a 20×.
- Teclas sintéticas en `window` con el mismo guion determinista (un paso cada 120 ms); si el juego llega a `gameover`, el guion lo reinicia con `Espacio`.
- Métricas: tiempo de frame medio y p95 (muestreo con `requestAnimationFrame`), tareas largas (`PerformanceObserver` con `longtask`), crecimiento del heap y commits de React por segundo (hook mínimo `__REACT_DEVTOOLS_GLOBAL_HOOK__` instalado con `addInitScript`).
- Cada celda se anota como **mediana (peor de las 3)**; «empeora» = la mediana final supera el peor valor de la línea base.
- Limitaciones del MCP: `browser_run_code_unsafe` no tiene `require`/`fs` (la configuración va en el propio código y los resultados se anotan a mano) y su `filename` debe estar dentro del repo (`.playwright-mcp/` está en `.gitignore`).
- Limitaciones de las métricas: el heap de 10 s es un diente de sierra del recolector (ruido de ±500 KB), y los commits de React por segundo suben cuando el motor simula más tiempo de juego por ventana (a 20× el motor recorta cada frame a 50 ms). Se interpretan como indicadores, no como veredicto.

## 6. Criterios de aceptación para el spec de un juego nuevo

Se copian al spec (sección *Acceptance criteria*; `references/spec-template.md` ya los trae):

- [ ] En el bucle (`update`/`draw`) no hay `forEach`, `map`, `filter`, `concat` ni spread, ni objetos o arrays creados por frame (`git grep -nE "\.(forEach|map|filter|concat)\(" -- lib/games/<id>/game.ts` solo en código de arranque o por evento).
- [ ] Fondo, sprites, degradados y `shadowBlur` se dibujan una vez en canvas fuera de pantalla, nunca por frame.
- [ ] `emitHud` solo crea el objeto cuando cambia un campo; la pantalla de juego no re-renderiza por frame.
- [ ] El motor se crea una vez por carga y por cambio de vista; tras SALIR no quedan listeners ni `requestAnimationFrame`.
- [ ] Medido con la CPU a 20× sobre el build de producción (§5): la tabla (frame medio, p95, tareas largas) queda en el spec, y cada optimización de §2 que aplica al juego está hecha o descartada con razón en *Decisions*.
