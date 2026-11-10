"use server";

import { revalidatePath } from "next/cache";
import { PLAYABLE_GAME_IDS } from "@/lib/games";
import {
  SCORE_LIMITS,
  type SaveScoreInput,
  type SaveScoreResult,
} from "@/lib/leaderboard";
import { createClient } from "@/lib/supabase/server";

// El nombre y el dueño de la marca salen de la sesión del servidor (SPEC 12), nunca del cliente.
// Esta acción no es la barrera de seguridad: lo son los CHECK y la RLS de `scores`
// (insert solo con user_id = auth.uid() y player_name = username del perfil).
export async function saveScore(input: SaveScoreInput): Promise<SaveScoreResult> {
  const gameId = input?.gameId;
  const score = input?.score;

  if (
    typeof gameId !== "string" ||
    !PLAYABLE_GAME_IDS.includes(gameId) ||
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 1 ||
    score > SCORE_LIMITS.maxScore
  ) {
    return { ok: false, error: "invalid" };
  }

  try {
    const supabase = await createClient();

    // getUser valida el token con Supabase Auth (las cookies por sí solas no son de fiar).
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { ok: false, error: "unauthenticated" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userData.user.id)
      .maybeSingle();
    // Sesión sin perfil: aún no eligió nombre, así que no puede guardar.
    if (!profile) return { ok: false, error: "unauthenticated" };

    const { error: insertError } = await supabase.from("scores").insert({
      game_id: gameId,
      player_name: profile.username,
      score,
      user_id: userData.user.id,
    });
    if (insertError) {
      console.error("[puntuación] No se pudo insertar:", insertError.message);
      return { ok: false, error: "save_failed" };
    }

    const { data, error: rankError } = await supabase.rpc("get_player_best", {
      p_game_id: gameId,
      p_player_name: profile.username,
    });
    if (rankError || !data || data.length === 0) {
      console.error("[puntuación] No se pudo leer el rango:", rankError?.message);
      return { ok: false, error: "save_failed" };
    }

    revalidatePath("/salon");
    revalidatePath(`/juegos/${gameId}`);

    return { ok: true, rank: data[0].rank };
  } catch (err) {
    console.error("[puntuación] Fallo al guardar:", err);
    return { ok: false, error: "save_failed" };
  }
}
