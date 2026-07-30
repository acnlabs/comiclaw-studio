/**
 * Offline checks for Credits attribution summaries.
 * Run: npx tsx scripts/verify-credits-ledger.ts
 */
import assert from "node:assert/strict";
import {
  summarizeEarned,
  summarizeSpent,
  type EarnedRow,
  type SpentRow,
} from "../src/lib/creditsLedger";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

const earned: EarnedRow[] = [
  {
    id: "l1",
    characterId: "c1",
    characterName: "阿虾",
    projectName: "第 1 记",
    points: 30,
    createdAt: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "l2",
    characterId: "c1",
    characterName: "阿虾",
    projectName: "第 2 记",
    points: 20,
    createdAt: "2026-07-02T00:00:00.000Z",
  },
  {
    id: "l3",
    characterId: "c2",
    characterName: "面馆老板",
    projectName: null,
    points: 5,
    createdAt: "2026-07-03T00:00:00.000Z",
  },
];

const e = summarizeEarned(earned);
assert.equal(e.total, 55);
assert.deepEqual(e.byCharacter, [
  { characterId: "c1", characterName: "阿虾", licenseCount: 2, credits: 50 },
  { characterId: "c2", characterName: "面馆老板", licenseCount: 1, credits: 5 },
]);
ok("earned groups by character and sorts by credits");

assert.deepEqual(summarizeEarned([]), { total: 0, byCharacter: [] });
ok("earned handles no licenses");

const spent: SpentRow[] = [
  {
    id: "s1",
    projectId: "p1",
    projectName: "第 1 记",
    action: "video_generate",
    amount: 30,
    status: "SUCCESS",
    createdAt: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "s2",
    projectId: "p1",
    projectName: "第 1 记",
    action: "asset_generate",
    amount: 5,
    status: "SUCCESS",
    createdAt: "2026-07-01T01:00:00.000Z",
  },
  {
    id: "s3",
    projectId: "p1",
    projectName: "第 1 记",
    action: "video_generate",
    amount: 30,
    status: "INSUFFICIENT_BALANCE",
    createdAt: "2026-07-01T02:00:00.000Z",
  },
  {
    id: "s4",
    projectId: "p2",
    projectName: null,
    action: null,
    amount: null,
    status: "SUCCESS",
    createdAt: "2026-07-02T00:00:00.000Z",
  },
];

const s = summarizeSpent(spent);
assert.equal(s.total, 35, "failed charges must not count toward spend");
assert.equal(s.failedCount, 1);
assert.deepEqual(s.byAction, [
  { action: "video_generate", count: 1, credits: 30 },
  { action: "asset_generate", count: 1, credits: 5 },
  { action: "unknown", count: 1, credits: 0 },
]);
ok("spent ignores failed charges and buckets missing actions");

assert.deepEqual(summarizeSpent([]), {
  total: 0,
  byAction: [],
  failedCount: 0,
});
ok("spent handles no charges");

console.log("\nAll credits ledger checks passed.");
