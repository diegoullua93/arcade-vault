import { DEFAULT_SKIN, type SkinId } from "../../skins";
import { createClassicSkin } from "./classic";
import { createMarioSkin } from "./mario";
import { createNeonSkin } from "./neon";
import type { ArkanoidSkin } from "./types";

export type { ArkanoidSkin } from "./types";

const FACTORIES: Record<SkinId, () => ArkanoidSkin> = {
  neon: createNeonSkin,
  classic: createClassicSkin,
  mario: createMarioSkin,
};

// Cada llamada crea una instancia nueva: caché, assets y efectos no se comparten entre motores
export function getSkin(id: SkinId = DEFAULT_SKIN): ArkanoidSkin {
  return (FACTORIES[id] ?? FACTORIES[DEFAULT_SKIN])();
}
