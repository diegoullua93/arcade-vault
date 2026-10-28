export const SCORE_LIMITS = { name: 20, maxScore: 9_999_999 } as const;

export type LeaderboardRow = {
  rank: number;
  name: string;
  score: number;
  date: string; // "dd/mm/aaaa"
};

export type SaveScoreInput = {
  gameId: string;
  playerName: string;
  score: number;
};

export type SaveScoreResult =
  | { ok: true; rank: number }
  | { ok: false; error: "invalid" | "save_failed" };
