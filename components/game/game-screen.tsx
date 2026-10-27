"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PlayerName } from "@/components/player-name";
import { getGame } from "@/lib/games";
import { createAsteroidsGame } from "@/lib/games/asteroids/game";
import type { GameCallbacks, GameHud, GameInstance } from "@/lib/games/types";

const ENGINES: Record<
  string,
  (canvas: HTMLCanvasElement, callbacks: GameCallbacks) => GameInstance
> = {
  asteroids: createAsteroidsGame,
};

const INITIAL_HUD: GameHud = {
  score: 0,
  lives: 3,
  level: 1,
  status: "playing",
};

export function GameScreen({ gameId }: { gameId: string }) {
  const game = getGame(gameId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState<GameHud>(INITIAL_HUD);

  useEffect(() => {
    const canvas = canvasRef.current;
    const createGame = ENGINES[gameId];
    if (!canvas || !createGame) return;

    const instance = createGame(canvas, { onHudChange: setHud });
    return () => instance.destroy();
  }, [gameId]);

  if (!game) return null;

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
            <Link href={`/juegos/${game.id}`} className="btn ghost">
              SALIR
            </Link>
          </div>
        </div>

        <div className="crt">
          <div className="crt-screen">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              style={{ display: "block", width: "100%", height: "100%" }}
            />
          </div>
          <div className="crt-bottom">
            <span className="led">SEÑAL OK</span>
            <span>{game.title} · CRT-83 · 60 HZ</span>
            <span>CARGA · 1MB</span>
          </div>
        </div>
      </div>
    </main>
  );
}
