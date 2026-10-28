import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GameScreen } from "@/components/game/game-screen";
import { PlayerName } from "@/components/player-name";
import { GAMES, PLAYABLE_GAME_IDS, getGame } from "@/lib/games";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export default function GamePlayerPage(props: PageProps<"/juegos/[id]/jugar">) {
  return (
    <Suspense fallback={<main className="av-main" />}>
      <GamePlayer params={props.params} />
    </Suspense>
  );
}

async function GamePlayer({ params }: { params: PageProps<"/juegos/[id]/jugar">["params"] }) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  if (PLAYABLE_GAME_IDS.includes(game.id)) {
    return <GameScreen gameId={game.id} />;
  }

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
              <div className="v">0</div>
            </div>
            <div className="hud-stat lives">
              <div className="l">Vidas</div>
              <div className="v">♥ ♥ ♥</div>
            </div>
            <div className="hud-stat level">
              <div className="l">Nivel</div>
              <div className="v">01</div>
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
            <div className="crt-content">
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  JUEGO PRÓXIMAMENTE
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  {game.title} AÚN NO ESTÁ DISPONIBLE
                </div>
              </div>
            </div>
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
