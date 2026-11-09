export const wrap = (v: number, max: number) => ((v % max) + max) % max;

// ¿Está `a` a menos de `r` de `b`? Compara distancias al cuadrado: sin Math.hypot ni raíz.
export const within = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  r: number,
) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy < r * r;
};

export const rand = (min: number, max: number) => min + Math.random() * (max - min);

export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
