"use client";

import { useRef, useState, type PointerEvent } from "react";
import { useTouchKeys, type TouchCode } from "./use-touch-keys";

export type TouchKey = "up" | "down" | "left" | "right" | "a" | "b";

const CODE: Record<TouchKey, TouchCode> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  a: "Space",
  b: "KeyX",
};

const LABEL: Record<TouchKey, string> = {
  up: "Arriba",
  down: "Abajo",
  left: "Izquierda",
  right: "Derecha",
  a: "Acción A",
  b: "Acción B",
};

const DIRECTIONS: TouchKey[] = ["up", "down", "left", "right"];

type Props = {
  touchKeys: TouchKey[]; // controles con función en este juego; el resto se muestra atenuado
  repeat: boolean; // autorepetido de la cruceta
  paused: boolean;
  gameover: boolean;
};

export function TouchControls({ touchKeys, repeat, paused, gameover }: Props) {
  const { press, release } = useTouchKeys();
  const [held, setHeld] = useState<ReadonlySet<TouchKey>>(new Set());
  // Un botón se libera solo con el dedo que lo pulsó: un segundo dedo encima se ignora
  const pointers = useRef(new Map<TouchKey, number>());

  const setPressed = (key: TouchKey, on: boolean) =>
    setHeld((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const down = (key: TouchKey) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!touchKeys.includes(key) || pointers.current.has(key)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(key, e.pointerId);
    setPressed(key, true);
    press(CODE[key], { repeat: repeat && DIRECTIONS.includes(key) });
  };

  const up = (key: TouchKey) => (e: PointerEvent<HTMLButtonElement>) => {
    if (pointers.current.get(key) !== e.pointerId) return;
    pointers.current.delete(key);
    setPressed(key, false);
    release(CODE[key]);
  };

  // PAUSA y REINICIAR: un keydown + keyup por toque
  const tap = (code: TouchCode) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    press(code);
    release(code);
  };

  const handlers = (key: TouchKey) => ({
    onPointerDown: down(key),
    onPointerUp: up(key),
    onPointerCancel: up(key),
    onLostPointerCapture: up(key),
  });

  const keyProps = (key: TouchKey) => ({
    type: "button" as const,
    tabIndex: -1,
    "aria-label": LABEL[key],
    "aria-disabled": !touchKeys.includes(key),
    "data-pressed": held.has(key),
    ...handlers(key),
  });

  return (
    <div
      className="touch-pad"
      role="group"
      aria-label="Controles táctiles"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="tp-dpad">
        {DIRECTIONS.map((key) => (
          <button key={key} {...keyProps(key)} className={`tp-dir tp-${key}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 6 19 17H5z" />
            </svg>
          </button>
        ))}
        <span className="tp-hub" aria-hidden="true" />
      </div>

      <div className="tp-ab">
        <button {...keyProps("b")} className="tp-round tp-b">
          B
        </button>
        <button {...keyProps("a")} className="tp-round tp-a">
          A
        </button>
      </div>

      <div className="tp-menu">
        <button
          type="button"
          tabIndex={-1}
          className="tp-pill"
          aria-label={paused ? "Seguir" : "Pausa"}
          onPointerDown={tap("KeyP")}
        >
          {paused ? "SEGUIR" : "PAUSA"}
        </button>
        {/* Siempre en el layout: aparece en gameover sin mover el marco */}
        <button
          type="button"
          tabIndex={-1}
          className="tp-pill tp-restart"
          aria-label="Reiniciar"
          data-visible={gameover}
          onPointerDown={tap("Space")}
        >
          REINICIAR
        </button>
      </div>
    </div>
  );
}
