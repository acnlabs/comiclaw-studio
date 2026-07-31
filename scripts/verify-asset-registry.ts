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
  sellerMatchesOwner,
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

console.log("\nAll asset registry checks passed.");
