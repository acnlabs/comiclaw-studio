/**
 * Offline checks for handing a published asset to an Org and taking it back.
 * Run: npx tsx scripts/verify-asset-transfer.ts
 */
import assert from "node:assert/strict";
import { checkTransfer, controlsAsset } from "../src/lib/assetTransfer";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

const ORG = "org_a3a067ed";
const OTHER_ORG = "org_someone_else";
const ALICE = { type: "agent", id: "agent-alice" } as const;
const HUMAN = { type: "user", id: "auth0|creator" } as const;

const published = (owner: { type: string; id: string }) => ({
  publishState: "published",
  ownerType: owner.type,
  ownerId: owner.id,
});

const none = { putInto: [], takeFrom: [] };

// The move the whole feature exists for.
assert.deepEqual(
  checkTransfer({
    asset: published(ALICE),
    actor: ALICE,
    entitlement: { putInto: [ORG], takeFrom: [] },
    target: { kind: "org", orgId: ORG },
  }),
  { ok: true, from: { type: "agent", id: "agent-alice" }, to: { type: "org", id: ORG } }
);
ok("an owner hands its asset to an Org it belongs to");

assert.deepEqual(
  checkTransfer({
    asset: published(ALICE),
    actor: ALICE,
    entitlement: { putInto: [ORG], takeFrom: [] },
    target: { kind: "org", orgId: OTHER_ORG },
  }),
  { ok: false, reason: "not_entitled_to_target" }
);
ok("an asset cannot be pushed into an unrelated Org");

// Membership is not governance: a member that could take assets back out could
// walk off with everything the Org holds.
assert.deepEqual(
  checkTransfer({
    asset: published({ type: "org", id: ORG }),
    actor: ALICE,
    entitlement: { putInto: [ORG], takeFrom: [] },
    target: { kind: "self" },
  }),
  { ok: false, reason: "not_owner" }
);
ok("a mere member cannot pull an Org's asset into its own name");

assert.deepEqual(
  checkTransfer({
    asset: published({ type: "org", id: ORG }),
    actor: HUMAN,
    entitlement: { putInto: [ORG], takeFrom: [ORG] },
    target: { kind: "self" },
  }),
  { ok: true, from: { type: "org", id: ORG }, to: { type: "user", id: "auth0|creator" } }
);
ok("whoever governs the Org can take the asset back out");

assert.deepEqual(
  checkTransfer({
    asset: published(HUMAN),
    actor: ALICE,
    entitlement: { putInto: [ORG], takeFrom: [ORG] },
    target: { kind: "org", orgId: ORG },
  }),
  { ok: false, reason: "not_owner" }
);
ok("someone else's asset cannot be handed away");

assert.deepEqual(
  checkTransfer({
    asset: { publishState: "draft", ownerType: null, ownerId: null },
    actor: HUMAN,
    entitlement: { putInto: [ORG], takeFrom: [ORG] },
    target: { kind: "org", orgId: ORG },
  }),
  { ok: false, reason: "not_published" }
);
assert.deepEqual(
  checkTransfer({
    asset: { publishState: "publishing", ownerType: "user", ownerId: HUMAN.id },
    actor: HUMAN,
    entitlement: { putInto: [ORG], takeFrom: [ORG] },
    target: { kind: "org", orgId: ORG },
  }),
  { ok: false, reason: "not_published" }
);
ok("only a settled, registered asset can change hands");

assert.deepEqual(
  checkTransfer({
    asset: published(HUMAN),
    actor: HUMAN,
    entitlement: none,
    target: { kind: "self" },
  }),
  { ok: false, reason: "same_owner" }
);
ok("transferring to the current holder is refused rather than round-tripped");

assert.deepEqual(
  checkTransfer({
    asset: { publishState: "published", ownerType: "org", ownerId: "   " },
    actor: HUMAN,
    entitlement: { putInto: [ORG], takeFrom: [ORG] },
    target: { kind: "self" },
  }),
  { ok: false, reason: "no_owner" }
);
ok("a published row with no usable owner is refused, not guessed at");

// Withdrawing a published asset is the holder's call, not the maker's. After a
// handover the author is still the author, and if authorship were enough they
// could revoke the registration of something the Org now owns — they could not
// take it back, but they could destroy it. Same shape as a project owner
// revoking a contributor's asset.
const heldByOrg = { type: "org", id: ORG } as const;
assert.equal(
  controlsAsset({ owner: heldByOrg, actor: ALICE, governs: [] }),
  false,
  "the agent that made it cannot act for the Org that now holds it"
);
assert.equal(
  controlsAsset({ owner: heldByOrg, actor: HUMAN, governs: [ORG] }),
  true,
  "the Org's governor can"
);
assert.equal(
  controlsAsset({ owner: ALICE, actor: ALICE, governs: [] }),
  true,
  "before any handover the maker still holds it"
);
assert.equal(
  controlsAsset({ owner: { type: "user", id: "auth0|maker" }, actor: HUMAN, governs: [ORG] }),
  false,
  "governing an Org says nothing about someone else's personal asset"
);
ok("acting for an asset follows who holds it, not who made it");

console.log("\nAll asset transfer checks passed.");
