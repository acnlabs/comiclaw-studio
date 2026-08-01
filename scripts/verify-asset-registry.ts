/**
 * Offline checks for the AgentPlanet asset registry contract.
 * Mirrors the ComicLaw × AgentPlanet registration matrix.
 * Run: npx tsx scripts/verify-asset-registry.ts
 */
import assert from "node:assert/strict";
import {
  ASSET_SOURCE,
  assetRef,
  registerAssetPayload,
  mayListAfterRegistration,
  registryActionPath,
  registryEntryPath,
  CHANGE_OWNER_REASONS,
  isChangeOwnerReason,
  REGISTRY_PATH,
  sellerMatchesOwner,
  storeProductPath,
  STORE_PRODUCTS_PATH,
  type AssetOwner,
} from "../src/lib/assetRegistry";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

// The namespace is derived from the source's first segment and must stay in sync.
assert.equal(ASSET_SOURCE, "comiclaw-studio");
assert.equal(assetRef("character", "char_042"), "comiclaw:character:char_042");
assert.equal(assetRef("scene", "scene_001"), "comiclaw:scene:scene_001");
assert.equal(assetRef("prop", "prop_007"), "comiclaw:prop:prop_007");
ok("asset_ref follows comiclaw:{kind}:{id} for all three kinds");

// Org-held scene: no acting agent, org id is the ACN org id.
const orgOwner: AssetOwner = { type: "org", id: "org_a3a067ed" };
assert.deepEqual(
  registerAssetPayload({
    kind: "scene",
    localId: "scene_001",
    owner: orgOwner,
    displayName: "教室·日内",
  }),
  {
    asset_ref: "comiclaw:scene:scene_001",
    source: "comiclaw-studio",
    asset_kind: "scene",
    owner_type: "org",
    owner_id: "org_a3a067ed",
    display_name: "教室·日内",
    bound_agent_id: null,
  }
);
ok("org-held scene registers with a null acting agent");

// Ownership and on-screen identity are separate: an org-held character is
// still played by a member agent, and that agent must not become the owner.
const payload = registerAssetPayload({
  kind: "character",
  localId: "char_042",
  owner: orgOwner,
  displayName: "漫剧大虾",
  boundAgentId: "agent-uuid",
});
assert.equal(payload.owner_id, "org_a3a067ed");
assert.equal(payload.bound_agent_id, "agent-uuid");
ok("org-held character keeps owner and acting agent distinct");

// A user principal is `user`, never `human`.
const userOwner: AssetOwner = { type: "user", id: "auth0|abc" };
assert.equal(registerAssetPayload({
  kind: "character",
  localId: "c1",
  owner: userOwner,
  displayName: "个人角色",
}).owner_type, "user");
ok("people register as user");

// Store rejects a listing whose seller differs from the registered owner,
// notably an org asset sold under a member agent.
assert.equal(sellerMatchesOwner({ type: "org", id: "org_a3a067ed" }, orgOwner), true);
assert.equal(sellerMatchesOwner({ type: "agent", id: "agent-uuid" }, orgOwner), false);
assert.equal(
  sellerMatchesOwner({ type: "agent", id: "a1" }, { type: "agent", id: "a2" }),
  false
);
ok("seller must match the registered owner exactly");

// The compat aliases still answer, so nothing fails loudly if new code drifts
// back to them — pin the canonical paths instead.
assert.equal(REGISTRY_PATH, "/api/assets/registry");
assert.equal(STORE_PRODUCTS_PATH, "/api/store/assets/products");
assert.ok(!REGISTRY_PATH.includes("/store/asset-registry"));
assert.ok(!STORE_PRODUCTS_PATH.includes("agent-assets"));
ok("registry and product paths are the canonical ones, not the aliases");

// A ref contains colons, so it has to survive being put in a path segment.
assert.equal(
  registryEntryPath("comiclaw:scene:scene_001"),
  "/api/assets/registry/comiclaw%3Ascene%3Ascene_001"
);
assert.equal(
  registryActionPath("comiclaw:character:char_042", "change-owner"),
  "/api/assets/registry/comiclaw%3Acharacter%3Achar_042/change-owner"
);
assert.equal(
  registryActionPath("comiclaw:prop:p1", "revoke"),
  "/api/assets/registry/comiclaw%3Aprop%3Ap1/revoke"
);
ok("asset refs are encoded into the path");

assert.equal(storeProductPath("prod_1"), "/api/store/assets/products/prod_1");
assert.equal(
  storeProductPath("prod_1", "unlist"),
  "/api/store/assets/products/prod_1/unlist"
);
assert.equal(
  storeProductPath("prod_1", "order"),
  "/api/store/assets/products/prod_1/order"
);
ok("store product paths cover listing, unlist and order");

// enforce is on in both environments, so listing an unregistered asset leaves
// the owner thinking a price took effect on something nobody can buy.
assert.equal(
  mayListAfterRegistration({ registration: "registered", ownerRealigned: false }),
  true,
  "a fresh registration needs no realignment"
);
assert.equal(
  mayListAfterRegistration({ registration: "failed", ownerRealigned: true }),
  false
);
assert.equal(
  mayListAfterRegistration({ registration: "exists", ownerRealigned: true }),
  true
);
assert.equal(
  mayListAfterRegistration({ registration: "exists", ownerRealigned: false }),
  false,
  "an existing entry still owned by someone else must not be listed"
);
ok("listing is fail-closed on the registry");

// AgentPlanet closed this vocabulary and refuses `sale` outright: a paid
// handover belongs to their order flow, which holds the row lock, ties the move
// to an order id and can roll it back on refund. A descriptive word reads fine
// here and comes back rejected — which our fail-closed callers turn into a 503.
assert.deepEqual([...CHANGE_OWNER_REASONS], ["rebind", "admin"]);
for (const invented of ["sale", "transfer", "publish", "listing", "realign"]) {
  assert.equal(
    isChangeOwnerReason(invented),
    false,
    `${invented} is not a reason the registry accepts`
  );
}
ok("change-owner only ever sends a reason the registry accepts");

console.log("\nAll asset registry checks passed.");
