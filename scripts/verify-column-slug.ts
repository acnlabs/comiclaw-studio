/**
 * Offline checks: Chinese column names don't steal a short leftover slug.
 * Run: npx tsx scripts/verify-column-slug.ts
 */
import assert from "node:assert/strict";
import {
  fallbackColumnSlug,
  firstFreeColumnSlug,
  slugifyLabel,
} from "../src/lib/slugify";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

async function main() {
  assert.equal(slugifyLabel("发现走查-0821"), "0821");
  assert.equal(slugifyLabel("发现走查"), "");
  assert.equal(slugifyLabel("Walk Discover 0821"), "walk-discover-0821");
  ok("Chinese names keep only latin remnants");

  const taken = new Set(["0821", "c-old"]);
  const isTaken = async (s: string) => taken.has(s);

  assert.equal(await firstFreeColumnSlug("发现走查-0821", isTaken, 1), "0821-2");
  ok("a colliding remnant gets -2");

  assert.equal(
    await firstFreeColumnSlug("Walk Discover 0821", isTaken, 1),
    "walk-discover-0821",
  );
  ok("a free latin slug stays as-is");

  const emptyTaken = async () => false;
  const generated = await firstFreeColumnSlug(
    "纯中文专栏",
    emptyTaken,
    1_700_000_000_000,
  );
  assert.equal(generated, fallbackColumnSlug(1_700_000_000_000));
  ok("a name with no latin letters falls back to c-{time}");

  console.log("\nall column-slug checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
