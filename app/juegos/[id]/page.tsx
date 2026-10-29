import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatPlays } from "@/lib/games";
import { getGame, getGames, getGamesWithStats } from "@/lib/queries/games";
import { getLeaderboard } from "@/lib/queries/scores";

export async function generateStaticParams() {
  const games = await getGames();
  return games.map((g) => ({ id: g.id }));
}

export default function GameDetailPage(props: PageProps<"/juegos/[id]">) {
  return (
    <Suspense fallback={<main className="av-main" />}>
      <GameDetail params={props.params} />
    </Suspense>
  );
}

async function GameDetail({ params }: { params: PageProps<"/juegos/[id]">["params"] }) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  return (
    <main className="av-main">
      <div className="av-detail fade-in">
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="detail-cover">
            <div className={"cover-bg " + game.cover}></div>
          </div>

          <div className="leaderboard">
            <h3>TOP 10 · {game.title}</h3>
            <Suspense fallback={<div className="lb-empty">CARGANDO…</div>}>
              <TopTen gameId={game.id} />
            </Suspense>
          </div>
        </div>

        <div className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>

          <div className="stat-strip">
            <Suspense fallback={<StatCells best="…" plays="…" />}>
              <GameStatCells gameId={game.id} />
            </Suspense>
            <div>
              <div className="l">Categoría</div>
              <div className="v">{game.cat}</div>
            </div>
          </div>

          <div className="detail-actions">
            <Link href={`/juegos/${game.id}/jugar`} className="btn lg pulse">
              JUGAR
            </Link>
            <Link href="/biblioteca" className="btn lg ghost">
              VOLVER
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

async function TopTen({ gameId }: { gameId: string }) {
  const rows = await getLeaderboard(gameId, 10);

  if (rows.length === 0) {
    return <div className="lb-empty">AÚN NO HAY PUNTUACIONES. ¡SÉ EL PRIMERO EN LA TABLA!</div>;
  }

  return rows.map((r, i) => (
    <div key={r.name} className={"lb-row" + (i < 3 ? ` top${i + 1}` : "")}>
      <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
      <div className="pl">{r.name}</div>
      <div className="sc">{r.score.toLocaleString("es-ES")}</div>
    </div>
  ));
}

async function GameStatCells({ gameId }: { gameId: string }) {
  const games = await getGamesWithStats();
  const stats = games.find((g) => g.id === gameId);
  const plays = stats?.plays ?? 0;

  return (
    <StatCells
      best={plays > 0 ? (stats?.best ?? 0).toLocaleString("es-ES") : "—"}
      plays={formatPlays(plays)}
    />
  );
}

function StatCells({ best, plays }: { best: string; plays: string }) {
  return (
    <>
      <div>
        <div className="l">Mejor puntuación</div>
        <div className="v">{best}</div>
      </div>
      <div>
        <div className="l">Partidas</div>
        <div className="v">{plays}</div>
      </div>
    </>
  );
}
