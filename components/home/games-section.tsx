import Link from "next/link";
import { MiniCard } from "@/components/home/mini-card";
import { Reveal } from "@/components/home/reveal";
import { SectionHead } from "@/components/home/section-head";
import { GAMES } from "@/lib/games";

export function GamesSection() {
  return (
    <Reveal className="home-section">
      <SectionHead kicker="// 02" color="cyan" title="JUEGOS DISPONIBLES AHORA" />
      <div className="mini-rail">
        {GAMES.slice(0, 6).map((g) => (
          <MiniCard key={g.id} game={g} />
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 24 }}>
        <Link href="/biblioteca" className="btn lg">
          VER TODOS LOS JUEGOS →
        </Link>
      </div>
    </Reveal>
  );
}
