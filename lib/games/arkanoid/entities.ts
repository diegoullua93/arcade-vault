import type { BlockColor } from "./constants";

export type Paddle = { x: number; y: number; w: number; h: number };
export type Ball = { x: number; y: number; w: number; h: number; vx: number; vy: number };
export type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
};
export type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number; // ms
};
