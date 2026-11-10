"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { saveScore } from "@/app/juegos/[id]/jugar/actions";
import { PlayerName } from "@/components/player-name";
import { useSession } from "@/components/session-provider";
import { createAsteroidsGame } from "@/lib/games/asteroids/game";
import { createArkanoidGame } from "@/lib/games/arkanoid/game";
import { createSerpentinaGame } from "@/lib/games/serpentina/game";
import { SKINS, type SkinId } from "@/lib/games/skins";
import { createTetrisGame } from "@/lib/games/tetris/game";
import { drawNextPiece, getSkin } from "@/lib/games/tetris/skins";
import type {
  GameCallbacks,
  GameHud,
  GameInstance,
  GameOptions,
  NextShape,
} from "@/lib/games/types";
import { TouchControls, type TouchKey } from "./touch-controls";
import { useHydrated, useSkin } from "./use-skin";

type GameConfig = {
  create: (
    canvas: HTMLCanvasElement,
    callbacks: GameCallbacks,
    options?: GameOptions,
  ) => GameInstance;
  width: number; // resolución interna del canvas
  height: number;
  showLives: boolean;
  showNext: boolean; // panel lateral con el canvas de la pieza siguiente
  skins: boolean; // el motor acepta options.skin (neon / classic / mario)
  touchKeys: TouchKey[]; // controles del mando táctil con función en este juego
  touchRepeat: boolean; // autorepetido de la cruceta (el motor actúa en cada keydown)
};

const GAMES_CONFIG: Record<string, GameConfig> = {
  asteroids: {
    create: createAsteroidsGame,
    width: 800,
    height: 600,
    showLives: true,
    showNext: false,
    skins: false,
    touchKeys: ["up", "left", "right", "a"],
    touchRepeat: false,
  },
  tetris: {
    create: createTetrisGame,
    width: 300,
    height: 600,
    showLives: false,
    showNext: true,
    skins: true,
    touchKeys: ["up", "down", "left", "right", "a", "b"],
    touchRepeat: true,
  },
  arkanoid: {
    create: createArkanoidGame,
    width: 800,
    height: 600,
    showLives: true,
    showNext: false,
    skins: true,
    touchKeys: ["left", "right", "a"],
    touchRepeat: false,
  },
  serpentina: {
    create: createSerpentinaGame,
    width: 800,
    height: 600,
    showLives: false,
    showNext: false,
    skins: false,
    touchKeys: ["up", "down", "left", "right"],
    touchRepeat: false,
  },
};

const NEXT_SIZE = 120;
const NEXT_BLOCK = 30;

// Canvas "siguiente" (solo Tetris): lo pinta React con la misma capa de dibujo que el motor
function drawNext(canvas: HTMLCanvasElement, shape: NextShape, skin: ReturnType<typeof getSkin>) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  drawNextPiece(ctx, skin, shape, NEXT_SIZE, NEXT_BLOCK);
}

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
  const config = GAMES_CONFIG[gameId] ?? GAMES_CONFIG.asteroids;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState<GameHud>(INITIAL_HUD);
  const [save, setSave] = useState<SaveState>(IDLE);
  const [skin, setSkin] = useSkin();
  const hydrated = useHydrated();
  const [pendingSkin, setPendingSkin] = useState<SkinId | null>(null);
  const instanceRef = useRef<GameInstance | null>(null);
  const activeSkin: SkinId = config.skins ? skin : "neon";

  // El callback del motor se crea una vez por partida: lee estos refs en vez de props/estado.
  const userNameRef = useRef<string | null>(null);
  const armedRef = useRef(true); // true = el próximo gameover guarda
  const runRef = useRef(0); // descarta respuestas de guardados ya obsoletos
  const scoreRef = useRef(0); // puntuación final, para REINTENTAR

  useEffect(() => {
    userNameRef.current = user?.name ?? null;
  }, [user]);

  // Sin pull-to-refresh mientras se juega: solo con GameScreen montado (SPEC 10)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("av-playing");
    return () => root.classList.remove("av-playing");
  }, []);

  const submit = useCallback(
    (score: number) => {
      const run = ++runRef.current;
      setSave({ kind: "saving" });
      saveScore({ gameId, score })
        .then((r): SaveState =>
          r.ok
            ? { kind: "saved", rank: r.rank }
            : r.error === "unauthenticated"
              ? { kind: "guest" }
              : { kind: "error" },
        )
        .catch((): SaveState => ({ kind: "error" }))
        .then((next) => {
          if (runRef.current === run) setSave(next);
        });
    },
    [gameId],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const createGame = GAMES_CONFIG[gameId]?.create;
    // Hasta hidratar, `skin` es el de por defecto aunque haya otra guardada: se espera para crear
    // el motor una sola vez con la vista correcta
    if (!canvas || !createGame || !hydrated) return;

    const previewSkin = config.showNext ? getSkin(activeSkin) : null;
    const instance = createGame(
      canvas,
      {
        onNextChange: (shape) => {
          if (nextCanvasRef.current && previewSkin)
            drawNext(nextCanvasRef.current, shape, previewSkin);
        },
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
            submit(next.score);
          } else if (next.status !== "paused") {
            // Partida nueva (restart): rearma y descarta cualquier guardado en vuelo.
            armedRef.current = true;
            runRef.current++;
            setSave(IDLE);
          }
        },
      },
      { skin: activeSkin },
    );
    instanceRef.current = instance;
    return () => {
      instanceRef.current = null;
      instance.destroy();
    };
  }, [gameId, submit, activeSkin, config.showNext, hydrated]);

  // Cambiar de vista recrea el motor (partida nueva): con partida en curso se pide confirmación
  const pickSkin = (id: SkinId, e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur(); // sin foco, Espacio sigue siendo hard drop / reinicio
    if (id === skin) {
      setPendingSkin(null);
      return;
    }
    if (hud.status !== "gameover" && hud.score > 0) {
      instanceRef.current?.pause();
      setPendingSkin(id);
      return;
    }
    setPendingSkin(null);
    setSkin(id);
  };

  const confirmSkin = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    if (pendingSkin) setSkin(pendingSkin);
    setPendingSkin(null);
  };

  const cancelSkin = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    setPendingSkin(null);
    instanceRef.current?.resume();
  };

  const skinPicker = config.skins && (
    <div className="skin-picker" role="group" aria-label="Vista del juego">
      <div className="l">Vista</div>
      {SKINS.map((s) => (
        <button
          key={s.id}
          type="button"
          className="skin-opt"
          data-skin={s.id}
          aria-pressed={s.id === skin}
          onClick={(e) => pickSkin(s.id, e)}
        >
          {s.label}
        </button>
      ))}
      {pendingSkin && (
        <div className="skin-confirm" aria-live="polite">
          <p>Cambiar de vista reinicia la partida.</p>
          <button type="button" className="skin-confirm-yes" onClick={confirmSkin}>
            Reiniciar
          </button>
          <button type="button" className="skin-confirm-no" onClick={cancelSkin}>
            Seguir
          </button>
        </div>
      )}
    </div>
  );

  const retry = (e: MouseEvent<HTMLButtonElement>) => {
    // Sin foco en el botón, Espacio reinicia la partida en vez de volver a pulsarlo.
    e.currentTarget.blur();
    const name = userNameRef.current;
    if (!name) {
      setSave({ kind: "guest" });
      return;
    }
    submit(scoreRef.current);
  };

  return (
    <main className="av-main">
      <div className="av-player fade-in">
        <div className="player-hud">
          <div className="hud-stats">
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
            {config.showLives && (
              <div className="hud-stat lives">
                <div className="l">Vidas</div>
                <div className="v">{"♥ ".repeat(hud.lives).trim() || "—"}</div>
              </div>
            )}
            <div className="hud-stat level">
              <div className="l">Nivel</div>
              <div className="v">{String(hud.level).padStart(2, "0")}</div>
            </div>
          </div>
          <div className="hud-actions">
            {!config.showNext && skinPicker}
            <Link href={`/juegos/${gameId}`} className="btn ghost">
              SALIR
            </Link>
          </div>
        </div>

        <div
          className={`crt crt--game${config.showNext ? " crt--side" : ""}${
            activeSkin !== "neon" ? ` crt--${activeSkin}` : ""
          }`}
          data-status={hud.status}
        >
          <div className="crt-screen">
            <canvas
              ref={canvasRef}
              width={config.width}
              height={config.height}
              style={{ display: "block", width: "100%", height: "100%" }}
            />
          </div>
          {config.showNext && (
            <aside className="av-next-panel" aria-label="Pieza siguiente">
              <div className="l">Siguiente</div>
              <div className="av-next-screen">
                <canvas ref={nextCanvasRef} width={NEXT_SIZE} height={NEXT_SIZE} />
              </div>
              {skinPicker}
            </aside>
          )}
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

        <TouchControls
          touchKeys={config.touchKeys}
          repeat={config.touchRepeat}
          paused={hud.status === "paused"}
          gameover={hud.status === "gameover"}
        />
      </div>
    </main>
  );
}
