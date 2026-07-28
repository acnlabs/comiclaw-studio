/**
 * Offline checks for per-user column / Org-create quota policy.
 * Run: npx tsx scripts/verify-column-quota.ts
 */
import assert from "node:assert/strict";
import {
  DEFAULT_MAX_ORG_CREATES_PER_DAY,
  DEFAULT_MAX_OWNED_COLUMNS,
  evaluateColumnQuota,
  nonNegativeInt,
  startOfUtcDay,
} from "../src/lib/columnQuota";

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

// Unset / blank / garbage must fall back, not collapse to 0 and block everyone
assert.equal(nonNegativeInt(undefined, DEFAULT_MAX_OWNED_COLUMNS), 5);
assert.equal(nonNegativeInt("", DEFAULT_MAX_OWNED_COLUMNS), 5);
assert.equal(nonNegativeInt("   ", DEFAULT_MAX_ORG_CREATES_PER_DAY), 2);
assert.equal(nonNegativeInt("abc", DEFAULT_MAX_ORG_CREATES_PER_DAY), 2);
assert.equal(nonNegativeInt("-3", DEFAULT_MAX_ORG_CREATES_PER_DAY), 2);
ok("unset/blank/invalid env falls back to defaults");

// Explicit 0 is a deliberate kill switch
assert.equal(nonNegativeInt("0", DEFAULT_MAX_OWNED_COLUMNS), 0);
assert.deepEqual(
  evaluateColumnQuota({
    ownedColumns: 0,
    orgCreatesToday: 0,
    wantsOrgCreate: false,
    maxColumns: 0,
    maxOrgsPerDay: 0,
  }),
  { allowed: false, reason: "columns", limit: 0 }
);
ok("explicit 0 disables self-serve");

console.log("\nAll column quota checks passed.");
