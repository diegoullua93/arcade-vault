import { Reveal } from "@/components/home/reveal";
import { buildStats } from "@/lib/home";

export function StatsSection({ gameCount }: { gameCount: number }) {
  return (
    <Reveal className="home-stats">
      <div className="stats-inner">
        {buildStats(gameCount).map((st, i) => (
          <div key={st.u} className="stat-block" style={{ transitionDelay: i * 90 + "ms" }}>
            <div className="stat-n neon-yellow">{st.n}</div>
            <div className="stat-u pixel">{st.u}</div>
            <div className="stat-s">{st.s}</div>
          </div>
        ))}
      </div>
    </Reveal>
  );
}
