import { COLS, PIECES, PIECE_TYPES } from "./constants";

export type Piece = {
  type: number;
  shape: number[][];
  x: number;
  y: number;
};

export function randomPiece(): Piece {
  const type = Math.floor(Math.random() * PIECE_TYPES) + 1;
  const shape = PIECES[type].map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}
