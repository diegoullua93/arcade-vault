import type { LeaderboardRow } from "@/lib/leaderboard";
import { createClient } from "@/lib/supabase/server";

// Zona fija y locale fijo: el servidor formatea la fecha para evitar hydration mismatch.
const dateFormat = new Intl.DateTimeFormat("es-ES", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

// Dinámico, sin caché: el ranking cambia con cada partida guardada.
export async function getLeaderboard(
  gameId: string,
  limit: number,
): Promise<LeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_leaderboard", {
    p_game_id: gameId,
    p_limit: limit,
  });

  if (error) throw new Error(`No se pudo leer el ranking: ${error.message}`);

  return data.map((r) => ({
    rank: r.rank,
    name: r.player_name,
    score: r.score,
    date: dateFormat.format(new Date(r.created_at)),
  }));
}
