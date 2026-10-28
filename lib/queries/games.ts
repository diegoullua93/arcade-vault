import { cacheLife, cacheTag } from "next/cache";
import type {
  Game,
  GameCategory,
  GameColor,
  GameWithStats,
} from "@/lib/games";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";

// Catálogo: casi no cambia, así que se cachea. Usa el cliente sin cookies
// porque `cookies()` no se puede leer dentro de `use cache`.
export async function getGames(): Promise<Game[]> {
  "use cache";
  cacheLife("max");
  cacheTag("games");

  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("games")
    .select("id, title, short, long, category, cover, color")
    .order("sort_order");

  if (error) throw new Error(`No se pudo leer el catálogo: ${error.message}`);

  // Los CHECK de la tabla garantizan que category y color son valores válidos.
  return data.map((g) => ({
    id: g.id,
    title: g.title,
    short: g.short,
    long: g.long,
    cat: g.category as GameCategory,
    cover: g.cover,
    color: g.color as GameColor,
  }));
}

export async function getGame(id: string): Promise<Game | null> {
  const games = await getGames();
  return games.find((g) => g.id === id) ?? null;
}

// Catálogo cacheado + estadísticas dinámicas (no se cachean: cambian con cada partida).
export async function getGamesWithStats(): Promise<GameWithStats[]> {
  const [games, supabase] = await Promise.all([getGames(), createClient()]);
  const { data, error } = await supabase
    .from("game_stats")
    .select("game_id, best, plays");

  if (error) throw new Error(`No se pudieron leer las estadísticas: ${error.message}`);

  const stats = new Map(data.map((s) => [s.game_id, s]));
  return games.map((g) => {
    const s = stats.get(g.id);
    return { ...g, best: s?.best ?? 0, plays: s?.plays ?? 0 };
  });
}
