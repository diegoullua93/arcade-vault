// Vistas (skins) de los juegos. El skin solo cambia la capa de dibujo: la simulación es idéntica.
export type SkinId = "neon" | "classic" | "mario";

export const SKINS: readonly { id: SkinId; label: string }[] = [
  { id: "neon", label: "NEÓN" },
  { id: "classic", label: "CLÁSICO" },
  { id: "mario", label: "MARIO BROS" },
];

export const DEFAULT_SKIN: SkinId = "neon";

export function isSkinId(value: unknown): value is SkinId {
  return SKINS.some((s) => s.id === value);
}
