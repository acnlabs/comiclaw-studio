/**
 * Offline checks for per-user column / Org-create quota policy.
 * Run: npx tsx scripts/verify-column-quota.ts
 */
import assert from "node:assert/strict";
import { evaluateColumnQuota, startOfUtcDay } from "../src/lib/columnQuota";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

const base = { maxColumns: 5, maxOrgsPerDay: 2 };

assert.deepEqual(
  evaluateColumnQuota({
    ownedColumns: 0,
    orgCreatesToday: 0,
    wantsOrgCreate: true,
    ...base,
  }),
  { allowed: true }
);
ok("first column with Org allowed");

assert.deepEqual(
  evaluateColumnQuota({
    ownedColumns: 5,
    orgCreatesToday: 0,
    wantsOrgCreate: false,
    ...base,
  }),
  { allowed: false, reason: "columns", limit: 5 }
);
ok("owned column cap blocks even without Org");

assert.deepEqual(
  evaluateColumnQuota({
    ownedColumns: 1,
    orgCreatesToday: 2,
    wantsOrgCreate: true,
    ...base,
  }),
  { allowed: false, reason: "orgs", limit: 2 }
);
ok("daily Org cap blocks orgMode=create");

assert.deepEqual(
  evaluateColumnQuota({
    ownedColumns: 1,
    orgCreatesToday: 2,
    wantsOrgCreate: false,
    ...base,
  }),
  { allowed: true }
);
ok("daily Org cap does not block orgMode=none");

const day = startOfUtcDay(new Date("2026-07-28T13:45:00Z"));
assert.equal(day.toISOString(), "2026-07-28T00:00:00.000Z");
ok("startOfUtcDay truncates to UTC midnight");

console.log("\nAll column quota checks passed.");
