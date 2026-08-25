import assert from "node:assert/strict";
import { nextClaimIndex, spiralCoord } from "../src/lib/plotSpiral";

const firstRing = [
  [0, 0],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

for (let i = 0; i < firstRing.length; i++) {
  const [x, y] = firstRing[i];
  assert.deepEqual(spiralCoord(i), { x, y }, `index ${i}`);
}

assert.equal(nextClaimIndex(undefined), 0);
assert.equal(nextClaimIndex(8), 9);
assert.deepEqual(spiralCoord(9), { x: 2, y: 1 });

console.log("plot spiral ok");
