# Sugerencias de juegos (game-planner)

Memoria del agente `game-planner` (`.claude/agents/game-planner.md`). Estados: `pendiente` · `aceptada` · `descartada` · `implementada`.

## Por decidir

- [ ] `invasores` — INVASORES (SHOOTER, green) · encaje 4.4/5 · sugerida 2026-11-02 · **recomendada**: fila ya en `games`, mecánica nueva (formación + búnkeres), leaderboard limpio; semillas (53K–279K) inalcanzables, borrarlas por migración
- [ ] `gloton` — GLOTÓN (ARCADE, yellow) · encaje 3.6/5 · sugerida 2026-11-02 · maze-chase con 4 fantasmas; tercer ARCADE y esfuerzo alto (laberinto + IA de fantasmas)
- [ ] `ranaria` — RANARIA (ARCADE, green) · encaje 3.6/5 · sugerida 2026-11-02 · cruce de carriles y río con temporizador; tercer ARCADE, puntuación por progreso a definir
- [ ] `duelo-pixel` — DUELO PIXEL (VERSUS, cyan) · encaje 3.4/5 · sugerida 2026-11-02 · cubriría VERSUS, pero leaderboard débil (2P local no encaja con un nombre) y repite paleta+pelota de Arkanoid
- [ ] `antimisiles` — ANTIMISILES (SHOOTER, magenta) · encaje 4.0/5 · sugerida 2026-11-02 · **recomendada (juego nuevo)**: defensa de ciudades al estilo Missile Command, apuntar a un punto + explosiones expansivas, mecánica inédita; necesita fila nueva en `games`
- [ ] `burbujas` — BURBUJAS (PUZZLE, cyan) · encaje 3.8/5 · sugerida 2026-11-02 · bubble shooter (apuntar y agrupar 3+ del mismo color); refuerza PUZZLE, pero rejilla hexagonal y rebotes suben el esfuerzo
- [ ] `estela` — ESTELA (VERSUS, cyan) · encaje 3.6/5 · sugerida 2026-11-02 · motos de luz contra la CPU; cubriría VERSUS, pero repite rejilla y choque con la cola de Serpentina
- [ ] `alunizaje` — ALUNIZAJE (ARCADE, yellow) · encaje 3.6/5 · sugerida 2026-11-02 · aterrizaje con combustible limitado; repite rotación + empuje con inercia de Asteroids y sería el tercer ARCADE

## Aceptadas (siguiente: /add-game)

## Descartadas

## Implementadas

- `asteroids` — spec 05
- `tetris` — spec 07
- `arkanoid` — spec 08
- `serpentina` — spec 09

## Historial

| Fecha      | Id            | Título      | Categoría | Encaje | Estado    | Notas                                                                                           |
| ---------- | ------------- | ----------- | --------- | ------ | --------- | ----------------------------------------------------------------------------------------------- |
| 2026-11-02 | `invasores`   | INVASORES   | SHOOTER   | 4.4    | pendiente | Recomendada como siguiente juego; desde cero (sin fuente en `references/`)                      |
| 2026-11-02 | `gloton`      | GLOTÓN      | ARCADE    | 3.6    | pendiente | Candidata alternativa; esfuerzo alto                                                            |
| 2026-11-02 | `ranaria`     | RANARIA     | ARCADE    | 3.6    | pendiente | Candidata alternativa                                                                           |
| 2026-11-02 | `duelo-pixel` | DUELO PIXEL | VERSUS    | 3.4    | pendiente | Candidata alternativa; leaderboard débil                                                        |
| 2026-11-02 | `antimisiles` | ANTIMISILES | SHOOTER   | 4.0    | pendiente | Recomendada como juego completamente nuevo; requiere migración para insertar la fila en `games` |
| 2026-11-02 | `burbujas`    | BURBUJAS    | PUZZLE    | 3.8    | pendiente | Alternativa nueva                                                                               |
| 2026-11-02 | `estela`      | ESTELA      | VERSUS    | 3.6    | pendiente | Alternativa nueva; mecánica cercana a Serpentina                                                |
| 2026-11-02 | `alunizaje`   | ALUNIZAJE   | ARCADE    | 3.6    | pendiente | Alternativa nueva; mecánica cercana a Asteroids                                                 |
