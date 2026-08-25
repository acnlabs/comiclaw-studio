/** Clockwise square spiral, east first, y-up. Index 0 is always (0, 0). */
export function spiralCoord(index: number): { x: number; y: number } {
  if (index <= 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  const dirs = [
    [1, 0],
    [0, -1],
    [-1, 0],
    [0, 1],
  ] as const;
  let dir = 0;
  let stepLen = 1;
  let left = index;
  while (left > 0) {
    for (let leg = 0; leg < 2 && left > 0; leg++) {
      const [dx, dy] = dirs[dir % 4];
      const steps = Math.min(stepLen, left);
      x += dx * steps;
      y += dy * steps;
      left -= steps;
      dir += 1;
    }
    stepLen += 1;
  }
  return { x, y };
}

export function nextClaimIndex(latest: number | null | undefined): number {
  return (latest ?? -1) + 1;
}
