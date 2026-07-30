/**
 * Offline checks for Credits attribution shaping.
 * Run: npx tsx scripts/verify-credits-ledger.ts
 */
import assert from "node:assert/strict";
import {
  shapeEarnedGroups,
  shapeSpentGroups,
  type EarnedGroup,
  type SpentGroup,
} from "../src/lib/creditsLedger";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

const names = new Map([
  ["c1", "阿虾"],
  ["c2", "面馆老板"],
]);

const earnedGroups: EarnedGroup[] = [
  { characterId: "c2", licenseCount: 1, credits: 5 },
  { characterId: "c1", licenseCount: 2, credits: 50 },
];

const earned = shapeEarnedGroups(earnedGroups, names);
assert.equal(earned.total, 55);
assert.deepEqual(earned.byCharacter, [
  { characterId: "c1", characterName: "阿虾", licenseCount: 2, credits: 50 },
  { characterId: "c2", characterName: "面馆老板", licenseCount: 1, credits: 5 },
]);
ok("earned sorts by credits and resolves character names");

// A deleted character should not blank out the row it earned on.
const orphan = shapeEarnedGroups(
  [{ characterId: "gone", licenseCount: 1, credits: 7 }],
  names
);
assert.equal(orphan.byCharacter[0].characterName, "gone");
assert.equal(orphan.total, 7);
ok("earned falls back to the id when a name is missing");

// Prisma returns null sums for empty groups; they must not become NaN.
const nullSum = shapeEarnedGroups(
  [{ characterId: "c1", licenseCount: 0, credits: null }],
  names
);
assert.equal(nullSum.total, 0);
assert.equal(nullSum.byCharacter[0].credits, 0);
ok("earned treats a null sum as zero");

assert.deepEqual(shapeEarnedGroups([], names), { total: 0, byCharacter: [] });
ok("earned handles no licenses");

const spentGroups: SpentGroup[] = [
  { action: "asset_generate", count: 3, credits: 15 },
  { action: "video_generate", count: 1, credits: 30 },
  { action: null, count: 1, credits: null },
];

const spent = shapeSpentGroups(spentGroups);
assert.equal(spent.total, 45);
assert.deepEqual(spent.byAction, [
  { action: "video_generate", count: 1, credits: 30 },
  { action: "asset_generate", count: 3, credits: 15 },
  { action: "unknown", count: 1, credits: 0 },
]);
ok("spent sorts by credits and buckets a missing action");

assert.deepEqual(shapeSpentGroups([]), { total: 0, byAction: [] });
ok("spent handles no charges");

console.log("\nAll credits ledger checks passed.");
