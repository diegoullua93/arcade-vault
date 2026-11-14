import { DEFAULT_SKIN, type SkinId } from "../../skins";
import type { NextShape } from "../../types";
import { createClassicSkin } from "./classic";
import { createMarioSkin } from "./mario";
import { createNeonSkin } from "./neon";
import type { TetrisSkin } from "./types";

export type { TetrisSkin } from "./types";

const FACTORIES: Record<SkinId, () => TetrisSkin> = {
  neon: createNeonSkin,
  classic: createClassicSkin,
  mario: createMarioSkin,
};

// Cada llamada crea una instancia nueva: caché y efectos no se comparten entre motores
export function getSkin(id: SkinId = DEFAULT_SKIN): TetrisSkin {
  return (FACTORIES[id] ?? FACTORIES[DEFAULT_SKIN])();
}

// Canvas de la pieza siguiente: centra la pieza en una rejilla de 4×4 bloques
export function drawNextPiece(
  ctx: CanvasRenderingContext2D,
  skin: TetrisSkin,
  shape: NextShape,
  size: number,
  block: number,
) {
  skin.drawPreviewBackground(ctx, size);
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      skin.drawBlock(ctx, offX + c, offY + r, shape[r][c], block);
}
