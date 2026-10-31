export type Rect = { x: number; y: number; w: number; h: number };

export function collideAABB(ball: Rect, block: Rect): boolean {
  return (
    ball.x < block.x + block.w &&
    ball.x + ball.w > block.x &&
    ball.y < block.y + block.h &&
    ball.y + ball.h > block.y
  );
}
