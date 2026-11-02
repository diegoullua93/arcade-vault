import { Suspense } from "react";
import { HallOfFame } from "@/components/hall-of-fame";
import type { LeaderboardRow } from "@/lib/leaderboard";
import { getGames } from "@/lib/queries/games";
import { getLeaderboard } from "@/lib/queries/scores";

export default function SalonPage() {
  return (
    <main className="av-main">
      <Suspense fallback={null}>
        <Hall />
      </Suspense>
    </main>
  );
}

async function Hall() {
  const games = await getGames();
  const entries = await Promise.all(
    games.map(async (g) => [g.id, await getLeaderboard(g.id, 12)] as const),
  );
  const rowsByGame: Record<string, LeaderboardRow[]> = Object.fromEntries(entries);

  return <HallOfFame games={games} rowsByGame={rowsByGame} />;
}
