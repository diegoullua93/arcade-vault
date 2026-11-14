// Compartida por los skins `classic` (se dibuja con fillRect, sin cargar fuentes).
// Fuente bitmap de 3×5 píxeles: cada glifo son 5 filas de 3 bits (el bit alto, a la izquierda).
// Solo mayúsculas, dígitos y algún signo; las tildes se quitan antes de dibujar.
const GLYPHS: Record<string, readonly number[]> = {
  A: [2, 5, 7, 5, 5],
  B: [6, 5, 6, 5, 6],
  C: [3, 4, 4, 4, 3],
  D: [6, 5, 5, 5, 6],
  E: [7, 4, 6, 4, 7],
  F: [7, 4, 6, 4, 4],
  G: [3, 4, 5, 5, 3],
  H: [5, 5, 7, 5, 5],
  I: [7, 2, 2, 2, 7],
  J: [1, 1, 1, 5, 2],
  K: [5, 5, 6, 5, 5],
  L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5],
  N: [6, 5, 5, 5, 5],
  O: [2, 5, 5, 5, 2],
  P: [6, 5, 6, 4, 4],
  Q: [2, 5, 5, 6, 3],
  R: [6, 5, 6, 5, 5],
  S: [3, 4, 2, 1, 6],
  T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7],
  V: [5, 5, 5, 5, 2],
  W: [5, 5, 7, 7, 5],
  X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2],
  Z: [7, 1, 2, 4, 7],
  "0": [7, 5, 5, 5, 7],
  "1": [2, 6, 2, 2, 7],
  "2": [6, 1, 2, 4, 7],
  "3": [6, 1, 2, 1, 6],
  "4": [5, 5, 7, 1, 1],
  "5": [7, 4, 6, 1, 6],
  "6": [3, 4, 7, 5, 7],
  "7": [7, 1, 2, 2, 2],
  "8": [7, 5, 7, 5, 7],
  "9": [7, 5, 7, 1, 6],
  ":": [0, 2, 0, 2, 0],
  "/": [1, 1, 2, 4, 4],
  ".": [0, 0, 0, 0, 2],
  "-": [0, 0, 7, 0, 0],
  "+": [0, 2, 7, 2, 0],
  "!": [2, 2, 2, 0, 2],
  "¡": [2, 0, 2, 2, 2],
  " ": [0, 0, 0, 0, 0],
};
const GLYPH_ADVANCE = 4; // 3 de glifo + 1 de espacio

export function bitmapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxWidth: number,
  maxScale: number,
  color: string,
) {
  const clean = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const units = clean.length * GLYPH_ADVANCE - 1;
  const scale = Math.max(1, Math.min(maxScale, Math.floor(maxWidth / units)));
  const x0 = Math.round(cx - (units * scale) / 2);
  const y0 = Math.round(cy - (5 * scale) / 2);
  ctx.fillStyle = color;
  for (let i = 0; i < clean.length; i++) {
    const rows = GLYPHS[clean[i]] ?? GLYPHS[" "];
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 3; c++)
        if (rows[r] & (4 >> c))
          ctx.fillRect(x0 + (i * GLYPH_ADVANCE + c) * scale, y0 + r * scale, scale, scale);
  }
}
