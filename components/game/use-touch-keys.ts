"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

// Autorepetido del mando (SPEC 10): imita el del teclado para los motores que actúan en cada keydown
export const REPEAT_DELAY_MS = 170;
export const REPEAT_INTERVAL_MS = 50;

// `code` que leen los motores -> `key` del evento sintético
const KEY_FOR_CODE = {
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Space: " ",
  KeyX: "x",
  KeyP: "p",
} as const;

export type TouchCode = keyof typeof KEY_FOR_CODE;

type Held = { delay?: number; interval?: number };

// Los motores escuchan en window, así que el evento se despacha ahí
function dispatch(type: "keydown" | "keyup", code: TouchCode, repeat: boolean) {
  window.dispatchEvent(
    new KeyboardEvent(type, {
      code,
      key: KEY_FOR_CODE[code],
      repeat,
      bubbles: true,
      cancelable: true,
    }),
  );
}

function stopTimers(held: Held) {
  if (held.delay !== undefined) window.clearTimeout(held.delay);
  if (held.interval !== undefined) window.clearInterval(held.interval);
}

/**
 * Traduce toques en KeyboardEvent sintéticos. `press` envía un keydown (repeat: false) y, con
 * `repeat`, programa el autorepetido; `release` envía el keyup y lo detiene; `releaseAll` libera
 * todo lo que siga pulsado. Al desmontar se libera todo.
 */
export function useTouchKeys() {
  const heldRef = useRef(new Map<TouchCode, Held>());

  const release = useCallback((code: TouchCode) => {
    const held = heldRef.current.get(code);
    if (!held) return;
    stopTimers(held);
    heldRef.current.delete(code);
    dispatch("keyup", code, false);
  }, []);

  const press = useCallback((code: TouchCode, options?: { repeat?: boolean }) => {
    if (heldRef.current.has(code)) return; // ya pulsada: un segundo dedo no la duplica
    const held: Held = {};
    heldRef.current.set(code, held);
    dispatch("keydown", code, false);
    if (options?.repeat) {
      held.delay = window.setTimeout(() => {
        held.interval = window.setInterval(
          () => dispatch("keydown", code, true),
          REPEAT_INTERVAL_MS,
        );
      }, REPEAT_DELAY_MS);
    }
  }, []);

  const releaseAll = useCallback(() => {
    for (const code of [...heldRef.current.keys()]) release(code);
  }, [release]);

  useEffect(() => releaseAll, [releaseAll]);

  return useMemo(() => ({ press, release, releaseAll }), [press, release, releaseAll]);
}
