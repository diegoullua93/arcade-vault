import type { BlockColor, SpriteRect } from "./constants";
import { SPRITES } from "./constants";

export type Paddle = { x: number; y: number; w: number; h: number };
export type Ball = { x: number; y: number; w: number; h: number; vx: number; vy: number };
export type Block = { x: number; y: number; w: number; h: number; color: BlockColor; alive: boolean };
export type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number; // ms
};

export type SpriteName = "paddle" | "ball" | `block_${BlockColor}`;

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  frame: SpriteRect,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  name: SpriteName,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const sprite = name.startsWith("block_")
    ? SPRITES.blocks[name.slice(6) as BlockColor]
    : SPRITES[name as "paddle" | "ball"];
  drawFrame(ctx, img, sprite, x, y, w, h);
}
