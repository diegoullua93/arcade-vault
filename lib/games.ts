export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: GameColor;
};

export type GameWithStats = Game & { best: number; plays: number };

// 987 -> "987", 12400 -> "12.4K"
export function formatPlays(plays: number): string {
  if (plays < 1000) return String(plays);
  return `${(plays / 1000).toFixed(1)}K`;
}

export const CATS: ("TODOS" | GameCategory)[] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
];

export const PLAYABLE_GAME_IDS: readonly string[] = ["asteroids"];
