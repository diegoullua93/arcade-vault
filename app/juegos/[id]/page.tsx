import Link from "next/link";
import { notFound } from "next/navigation";
import { GAMES, getGame } from "@/lib/games";
import { seededScores } from "@/lib/scores";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export default async function GameDetailPage({
  params,
}: PageProps<"/juegos/[id]">) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  const seed = [...game.id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const rows = seededScores(seed, 10);

  return (
    <main className="av-main">
      <div className="av-detail fade-in">
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="detail-cover">
            <div className={"cover-bg " + game.cover}></div>
          </div>

          <div className="leaderboard">
            <h3>TOP 10 · {game.title}</h3>
            {rows.map((r, i) => (
              <div
                key={r.name}
                className={
                  "lb-row" + (i < 3 ? ` top${i + 1}` : "")
                }
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>

          <div className="stat-strip">
            <div>
              <div className="l">Mejor puntuación</div>
              <div className="v">{game.best.toLocaleString("es-ES")}</div>
            </div>
            <div>
              <div className="l">Partidas</div>
              <div className="v">{game.plays}</div>
            </div>
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
