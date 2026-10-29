"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { saveScore } from "@/app/juegos/[id]/jugar/actions";
import { PlayerName } from "@/components/player-name";
import { useSession } from "@/components/session-provider";
import { createAsteroidsGame } from "@/lib/games/asteroids/game";
import type { GameCallbacks, GameHud, GameInstance } from "@/lib/games/types";

const ENGINES: Record<
  string,
  (canvas: HTMLCanvasElement, callbacks: GameCallbacks) => GameInstance
> = {
  asteroids: createAsteroidsGame,
};

const LED_LABEL: Record<GameHud["status"], string> = {
  playing: "SEÑAL OK",
  dead: "SEÑAL OK",
  paused: "EN PAUSA",
  gameover: "FIN DE PARTIDA",
};

const INITIAL_HUD: GameHud = {
  score: 0,
  lives: 3,
  level: 1,
  status: "playing",
};

type SaveState =
  | { kind: "idle" }
  | { kind: "guest" }
  | { kind: "saving" }
  | { kind: "saved"; rank: number }
  | { kind: "error" };

const IDLE: SaveState = { kind: "idle" };

export function GameScreen({ gameId, title }: { gameId: string; title: string }) {
  const { user } = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState<GameHud>(INITIAL_HUD);
  const [save, setSave] = useState<SaveState>(IDLE);

  // El callback del motor se crea una vez por partida: lee estos refs en vez de props/estado.
  const userNameRef = useRef<string | null>(null);
  const armedRef = useRef(true); // true = el próximo gameover guarda
  const runRef = useRef(0); // descarta respuestas de guardados ya obsoletos
  const scoreRef = useRef(0); // puntuación final, para REINTENTAR

  useEffect(() => {
    userNameRef.current = user?.name ?? null;
  }, [user]);

  const submit = useCallback(
    (score: number, playerName: string) => {
      const run = ++runRef.current;
      setSave({ kind: "saving" });
      saveScore({ gameId, playerName, score })
        .then((r): SaveState => (r.ok ? { kind: "saved", rank: r.rank } : { kind: "error" }))
        .catch((): SaveState => ({ kind: "error" }))
        .then((next) => {
          if (runRef.current === run) setSave(next);
        });
    },
    [gameId],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const createGame = ENGINES[gameId];
    if (!canvas || !createGame) return;

    const instance = createGame(canvas, {
      onHudChange: (next) => {
        setHud(next);

        if (next.status === "gameover") {
          // Una sola llamada por partida: pausar y reanudar sobre el gameover no repite.
          if (!armedRef.current) return;
          armedRef.current = false;
          scoreRef.current = next.score;
          if (next.score <= 0) return;

          const name = userNameRef.current;
          if (!name) {
            setSave({ kind: "guest" });
            return;
          }
          submit(next.score, name);
        } else if (next.status !== "paused") {
          // Partida nueva (restart): rearma y descarta cualquier guardado en vuelo.
          armedRef.current = true;
          runRef.current++;
          setSave(IDLE);
        }
      },
    });
    return () => instance.destroy();
  }, [gameId, submit]);

  const retry = (e: MouseEvent<HTMLButtonElement>) => {
    // Sin foco en el botón, Espacio reinicia la partida en vez de volver a pulsarlo.
    e.currentTarget.blur();
    const name = userNameRef.current;
    if (!name) {
      setSave({ kind: "guest" });
      return;
    }
    submit(scoreRef.current, name);
  };

  return (
    <main className="av-main">
      <div className="av-player fade-in">
        <div className="player-hud">
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div className="hud-stat">
              <div className="l">Jugador</div>
              <div className="v" style={{ color: "var(--ink)" }}>
                <PlayerName />
              </div>
            </div>
            <div className="hud-stat">
              <div className="l">Puntuación</div>
              <div className="v">{hud.score}</div>
            </div>
            <div className="hud-stat lives">
              <div className="l">Vidas</div>
              <div className="v">{"♥ ".repeat(hud.lives).trim() || "—"}</div>
            </div>
            <div className="hud-stat level">
              <div className="l">Nivel</div>
              <div className="v">{String(hud.level).padStart(2, "0")}</div>
            </div>
          </div>
          <div className="hud-actions">
            <Link href={`/juegos/${gameId}`} className="btn ghost">
              SALIR
            </Link>
          </div>
        </div>

        <div className="crt crt--game" data-status={hud.status}>
          <div className="crt-screen">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              style={{ display: "block", width: "100%", height: "100%" }}
            />
          </div>
          <div className="crt-bottom">
            <span className="led">{LED_LABEL[hud.status]}</span>
            <span>{title} · CRT-83 · 60 HZ</span>
            <span className="save-status" data-state={save.kind} role="status" aria-live="polite">
              {save.kind === "idle" && "CARGA · 1MB"}
              {save.kind === "saving" && "GUARDANDO"}
              {save.kind === "saved" && `GUARDADO #${save.rank}`}
              {save.kind === "error" && (
                <>
                  ERROR
                  <button type="button" className="save-retry" onClick={retry}>
                    REINTENTAR
                  </button>
                </>
              )}
              {save.kind === "guest" && (
                <Link href="/auth" className="save-link">
                  INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN
                </Link>
              )}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
