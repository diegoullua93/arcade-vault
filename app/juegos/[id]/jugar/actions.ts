"use server";

import { revalidatePath } from "next/cache";
import { PLAYABLE_GAME_IDS } from "@/lib/games";
import {
  SCORE_LIMITS,
  type SaveScoreInput,
  type SaveScoreResult,
} from "@/lib/leaderboard";
import { createClient } from "@/lib/supabase/server";

// Quita caracteres de control y recorta: el nombre llega de una sesión mock en el navegador.
function cleanName(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim()
    : "";
}

// No es una barrera de seguridad: quien use la API de Supabase directamente
// se salta esta acción. Solo frenan los CHECK y las políticas RLS de la tabla.
export async function saveScore(input: SaveScoreInput): Promise<SaveScoreResult> {
  const gameId = input?.gameId;
  const playerName = cleanName(input?.playerName);
  const score = input?.score;

  if (
    typeof gameId !== "string" ||
    !PLAYABLE_GAME_IDS.includes(gameId) ||
    !playerName ||
    // Cuenta puntos de código, igual que char_length() en la base de datos.
    [...playerName].length > SCORE_LIMITS.name ||
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 1 ||
    score > SCORE_LIMITS.maxScore
  ) {
    return { ok: false, error: "invalid" };
  }

  try {
    const supabase = await createClient();

    const { error: insertError } = await supabase
      .from("scores")
      .insert({ game_id: gameId, player_name: playerName, score });
    if (insertError) {
      console.error("[puntuación] No se pudo insertar:", insertError.message);
      return { ok: false, error: "save_failed" };
    }

    const { data, error: rankError } = await supabase.rpc("get_player_best", {
      p_game_id: gameId,
      p_player_name: playerName,
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
