/**
 * Offline checks for the rule that only production writes to outside systems.
 * Run: npx tsx scripts/verify-external-writes.ts
 */
import assert from "node:assert/strict";
import {
  refuseExternalWrite,
  isProductionRuntime,
  previewDatabaseIsShared,
} from "../src/lib/externalWrites";

const ok = (label: string) => console.log(`✓ ${label}`);

const withEnv = <T>(value: string | undefined, fn: () => T): T => {
  const before = process.env.VERCEL_ENV;
  if (value === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = value;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = before;
  }
};

// A preview build holds the same production credentials, so a write from one
// reaches the live Org or the live store. That is the case this exists for.
withEnv("preview", () => {
  const refused = refuseExternalWrite("acn", "POST", "/api/v1/orgs/x/members");
  assert.ok(refused, "a preview must not write to ACN");
  assert.equal(refused.status, 403);
});
ok("a preview deployment cannot write to ACN");

withEnv("preview", () => {
  assert.ok(refuseExternalWrite("agentplanet", "POST", "/api/store/assets/products"));
  assert.ok(refuseExternalWrite("agentplanet", "PATCH", "/api/assets/registry/x"));
  assert.ok(refuseExternalWrite("agentplanet", "DELETE", "/api/store/x"));
});
ok("every write verb is refused, not just POST");

// Reading is what a preview is for, and a read cannot move money or membership.
withEnv("preview", () => {
  assert.equal(refuseExternalWrite("acn", "GET", "/api/v1/orgs/x"), null);
  assert.equal(refuseExternalWrite("agentplanet", undefined, "/api/assets/registry/x"), null);
  assert.equal(refuseExternalWrite("acn", "HEAD", "/api/v1/orgs/x"), null);
});
ok("reads stay open on preview, including when no method is given");

withEnv("production", () => {
  assert.equal(refuseExternalWrite("acn", "POST", "/api/v1/orgs/x/members"), null);
  assert.ok(isProductionRuntime());
});
ok("production writes normally");

// Local runs and CI have no VERCEL_ENV; blocking them would break the fakes.
withEnv(undefined, () => {
  assert.equal(refuseExternalWrite("acn", "POST", "/api/v1/orgs/x/members"), null);
  assert.ok(isProductionRuntime());
});
ok("local and CI are unaffected");

withEnv("development", () => {
  assert.ok(refuseExternalWrite("acn", "POST", "/x"), "Vercel dev deployments are not production");
});
ok("a Vercel development deployment is treated like preview");

// The database is the other half: a preview gets production's DATABASE_URL too,
// so any branch could write live rows just by being deployed.
const withFlag = <T>(env: string | undefined, flag: string | undefined, fn: () => T): T => {
  const beforeFlag = process.env.PREVIEW_DATABASE_IS_SHADOW;
  if (flag === undefined) delete process.env.PREVIEW_DATABASE_IS_SHADOW;
  else process.env.PREVIEW_DATABASE_IS_SHADOW = flag;
  try {
    return withEnv(env, fn);
  } finally {
    if (beforeFlag === undefined) delete process.env.PREVIEW_DATABASE_IS_SHADOW;
    else process.env.PREVIEW_DATABASE_IS_SHADOW = beforeFlag;
  }
};

assert.equal(withFlag("preview", undefined, previewDatabaseIsShared), true);
ok("a preview with no shadow database is treated as sharing production's");

assert.equal(withFlag("preview", "1", previewDatabaseIsShared), false);
assert.equal(withFlag("preview", "true", previewDatabaseIsShared), false);
ok("declaring a shadow database lets the preview write again");

assert.equal(withFlag("production", undefined, previewDatabaseIsShared), false);
assert.equal(withFlag(undefined, undefined, previewDatabaseIsShared), false);
ok("production and local are never treated as sharing");

console.log("\nall external-write checks passed");
