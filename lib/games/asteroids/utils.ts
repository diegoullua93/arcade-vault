export const wrap = (v: number, max: number) => ((v % max) + max) % max;

export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

export const rand = (min: number, max: number) => min + Math.random() * (max - min);

export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
