import { Suspense } from "react";
import { Library } from "@/components/library";
import { getGamesWithStats } from "@/lib/queries/games";

export default function BibliotecaPage() {
  return (
    <main className="av-main fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>
      <Suspense fallback={null}>
        <LibraryWithStats />
      </Suspense>
    </main>
  );
}

async function LibraryWithStats() {
  const games = await getGamesWithStats();
  return <Library games={games} />;
}
