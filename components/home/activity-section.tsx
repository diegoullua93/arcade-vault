import Link from "next/link";
import { Reveal } from "@/components/home/reveal";
import { SectionHead } from "@/components/home/section-head";
import { RECENT_SCORES, TOP_PLAYERS } from "@/lib/home";

function RecentScoresCard() {
  return (
    <div className="activity-card">
      <div className="ac-head">
        <div className="ac-title pixel">▸ ÚLTIMAS PUNTUACIONES</div>
      </div>
      <div className="ticker">
        {RECENT_SCORES.map((r, i) => (
          <div
            key={r.player}
            className="tick-row"
            style={{ animationDelay: i * 60 + "ms" }}
          >
            <span className={"tk-p neon-" + r.color}>{r.player}</span>
            <span className="tk-mid">▸ {r.game}</span>
            <span className="tk-s">+{r.score.toLocaleString("es-ES")}</span>
            <span className="tk-t">{r.ago}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopPlayersCard() {
  return (
    <div className="activity-card">
      <div className="ac-head">
        <div className="ac-title pixel neon-magenta">▸ TOP JUGADORES · HOY</div>
        <Link href="/salon" className="lb-link">
          VER SALÓN →
        </Link>
      </div>
      <div className="top-list">
        {TOP_PLAYERS.map((r, i) => (
          <div key={r.player} className={"top-row" + (i < 3 ? ` top${i + 1}` : "")}>
            <span className="tp-rk">#{String(r.rank).padStart(2, "0")}</span>
            <span className="tp-bar">
              <span className="tp-fill" style={{ width: 100 - i * 16 + "%" }}></span>
            </span>
            <span className="tp-p">{r.player}</span>
            <span className="tp-s">{r.score.toLocaleString("es-ES")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActivitySection() {
  return (
    <Reveal className="home-section">
      <SectionHead kicker="// 03" color="yellow" title="ACTIVIDAD EN VIVO" />
      <div className="activity-grid">
        <RecentScoresCard />
        <TopPlayersCard />
      </div>
    </Reveal>
  );
}
