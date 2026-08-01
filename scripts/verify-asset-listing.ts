/**
 * Offline checks for what the Store should look like for a priced asset.
 * Run: npx tsx scripts/verify-asset-listing.ts
 */
import assert from "node:assert/strict";
import { planListing } from "../src/lib/assetListing";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

const ALICE = { type: "agent", id: "agent-alice" };
const ORG = { type: "org", id: "org_a3a067ed" };

assert.deepEqual(
  planListing({
    publishState: "published",
    licensePoints: 30,
    storeProductId: null,
    current: ALICE,
  }),
  { kind: "list", owner: { type: "agent", id: "agent-alice" } }
);
ok("a priced, published asset gets listed under its owner");

assert.deepEqual(
  planListing({
    publishState: "draft",
    licensePoints: 30,
    storeProductId: null,
    current: ALICE,
  }),
  { kind: "none" }
);
ok("an unpublished asset is never listed, price or not");

assert.deepEqual(
  planListing({
    publishState: "published",
    licensePoints: 0,
    storeProductId: "prod_1",
    current: ALICE,
  }),
  { kind: "unlist", seller: { type: "agent", id: "agent-alice" } }
);
assert.deepEqual(
  planListing({
    publishState: "unpublishing",
    licensePoints: 30,
    storeProductId: "prod_1",
    current: ALICE,
  }),
  { kind: "unlist", seller: { type: "agent", id: "agent-alice" } }
);
ok("dropping the price or withdrawing takes the product down");

// The whole reason this is a plan and not a flag: a Store product's seller is
// fixed, so an asset that changed hands needs the old product taken down under
// the old seller and a new one opened under the new owner. Skipping this keeps
// paying the previous owner.
assert.deepEqual(
  planListing({
    publishState: "published",
    licensePoints: 30,
    storeProductId: "prod_1",
    current: ORG,
    listedUnder: ALICE,
  }),
  {
    kind: "relist",
    from: { type: "agent", id: "agent-alice" },
    to: { type: "org", id: "org_a3a067ed" },
  }
);
ok("a transferred asset is relisted under the new owner");

assert.deepEqual(
  planListing({
    publishState: "published",
    licensePoints: 30,
    storeProductId: "prod_1",
    current: ALICE,
    listedUnder: ALICE,
  }),
  { kind: "list", owner: { type: "agent", id: "agent-alice" } }
);
ok("an unchanged owner just updates the existing product");

assert.deepEqual(
  planListing({
    publishState: "published",
    licensePoints: 30,
    storeProductId: "prod_1",
    current: { type: null, id: null },
  }),
  { kind: "orphan" }
);
ok("a product with no owner to match as seller is flagged, not guessed at");

assert.deepEqual(
  planListing({
    publishState: "published",
    licensePoints: 0,
    storeProductId: null,
    current: ALICE,
  }),
  { kind: "none" }
);
ok("free stays free: nothing to do without a price or a product");

console.log("\nAll asset listing checks passed.");
