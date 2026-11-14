---
name: spec-impl-game
description: Implementa un spec de juego aprobado y completa el trabajo en cadena, en este orden y nunca en paralelo: /spec-impl, luego el agente skin-designer (3 skins) y luego el agente mobil-porter (móvil/táctil). Úsalo cuando el usuario pida implementar un juego de punta a punta.
disable-model-invocation: true
argument-hint: '<NN-spec-name>'
allowed-tools: Skill, Agent, SendMessage, Read, Glob, Grep, AskUserQuestion, Bash(git status:*), Bash(git branch:*)
---

# /spec-impl-game — Spec → skins → móvil

Argumento recibido: `$ARGUMENTS` (nombre del spec, p. ej. `10-juego-pong`). Si está vacío, pídelo al usuario antes de empezar.

Responde en español. Las tres fases se ejecutan **una detrás de otra, nunca en simultáneo**: no lances la siguiente hasta tener el resultado final de la anterior.

## Fase 1 — `/spec-impl`

Invoca el skill con `Skill` (`skill: spec-impl`, `args: $ARGUMENTS`) y sigue sus instrucciones completas, incluidas sus pausas de revisión con el usuario.

No avances hasta que la implementación esté terminada y verificada (`npm run lint` y `npm run build` sin errores). Si el spec no está aprobado, falla o el usuario interrumpe, **detente** e informa; no ejecutes las fases 2 y 3.

Al terminar, anota el `id` del juego implementado (el de `PLAYABLE_GAME_IDS`) y la rama actual.

## Fase 2 — agente `skin-designer`

Solo con la fase 1 terminada. Lanza **una única** llamada `Agent` en primer plano:

- `subagent_type: skin-designer`
- prompt: indica el `id` del juego recién implementado, la rama actual y que debe trabajar solo ese juego (completar sus 3 skins `neon`, `classic`, `mario`) y no commitear.

Espera su informe final. Si devuelve un bloque `## PREGUNTAS PARA EL USUARIO` o una pregunta pendiente, hazla al usuario y reenvía la respuesta con `SendMessage` al mismo agente antes de continuar. Si falla (lint, build o verificación en navegador), detente e informa.

## Fase 3 — agente `mobil-porter`

Solo después de recibir el informe final de `skin-designer` (depende de los cambios que éste hace en `game-screen.tsx`). Lanza **una única** llamada `Agent` en primer plano:

- `subagent_type: mobil-porter`
- prompt: mismo `id` de juego y rama; debe auditar y portar solo ese juego a móvil según el SPEC 10 y no commitear.

Gestiona sus preguntas igual que en la fase 2.

## Reglas

- Prohibido lanzar `skin-designer` y `mobil-porter` en el mismo bloque de llamadas o con `run_in_background`.
- No commitees ni hagas push salvo que el usuario lo pida.
- Si una fase falla, no ejecutes las siguientes.

## Resumen final

Por fase: qué se hizo, rama, archivos creados/modificados, resultado de lint/build, capturas del navegador y pendientes que el usuario debe revisar (reporta los de cada agente tal cual).
