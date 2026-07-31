/**
 * Offline checks for project-asset publishing rules.
 * Run: npx tsx scripts/verify-asset-publish.ts
 */
import assert from "node:assert/strict";
import {
  agentCanPublish,
  assetKindFor,
  blocksAssetDelete,
  blocksProjectDelete,
  canPublishAsAuthor,
  checkPublishable,
  deletableState,
  resolvePublishOwner,
} from "../src/lib/assetPublish";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

assert.equal(assetKindFor("CHARACTER"), "character");
assert.equal(assetKindFor("SCENE"), "scene");
assert.equal(assetKindFor("PROP"), "prop");
assert.equal(assetKindFor("SOMETHING_ELSE"), null);
ok("asset types map onto the three registry kinds");

// Whoever made it owns it. An agent's contribution stays the agent's even when
// it was made inside a column bound to an Org — deriving ownership from the
// container would quietly transfer the creator's work, revenue included.
assert.deepEqual(
  resolvePublishOwner({
    authorUserId: null,
    authorAgentId: "agent-uuid",
    publisherSub: "auth0|abc",
  }),
  { ok: true, owner: { type: "agent", id: "agent-uuid" } }
);
ok("an agent-authored asset is owned by that agent");

assert.deepEqual(
  resolvePublishOwner({
    authorUserId: "auth0|author",
    authorAgentId: null,
    publisherSub: "auth0|author",
  }),
  { ok: true, owner: { type: "user", id: "auth0|author" } }
);
ok("a human-authored asset is owned by that human");

// Pre-authorship rows have no author; canPublishAsAuthor already limits those
// to the project owner's own PRIVATE work.
assert.deepEqual(
  resolvePublishOwner({
    authorUserId: null,
    authorAgentId: null,
    publisherSub: "auth0|abc",
  }),
  { ok: true, owner: { type: "user", id: "auth0|abc" } }
);
assert.deepEqual(
  resolvePublishOwner({
    authorUserId: "   ",
    authorAgentId: "   ",
    publisherSub: "auth0|abc",
  }),
  { ok: true, owner: { type: "user", id: "auth0|abc" } }
);
ok("a pre-authorship row falls to the publisher");

assert.deepEqual(
  resolvePublishOwner({
    authorUserId: null,
    authorAgentId: null,
    publisherSub: null,
  }),
  { ok: false, reason: "no_principal" }
);
ok("refuses to publish with no principal to own it");

const versions = ["v3", "v2", "v1"];

assert.deepEqual(
  checkPublishable({ type: "SCENE", publishState: "draft", versionIds: versions }),
  { ok: true, versionId: "v3" }
);
ok("defaults to the newest version");

assert.deepEqual(
  checkPublishable({
    type: "SCENE",
    publishState: "draft",
    versionIds: versions,
    requestedVersionId: "v2",
  }),
  { ok: true, versionId: "v2" }
);
ok("honours an explicit version pick");

// Pinning a version id from another asset would publish someone else's art.
assert.deepEqual(
  checkPublishable({
    type: "SCENE",
    publishState: "draft",
    versionIds: versions,
    requestedVersionId: "someone-elses-version",
  }),
  { ok: false, reason: "unknown_version" }
);
ok("rejects a version that does not belong to the asset");

assert.deepEqual(
  checkPublishable({ type: "SCENE", publishState: "draft", versionIds: [] }),
  { ok: false, reason: "no_versions" }
);
ok("refuses to publish an asset with no artwork");

assert.deepEqual(
  checkPublishable({
    type: "SCENE",
    publishState: "published",
    versionIds: versions,
  }),
  { ok: false, reason: "already_published" }
);
ok("publishing twice is rejected");

// An in-flight publish must not be publishable again either.
assert.deepEqual(
  checkPublishable({
    type: "SCENE",
    publishState: "publishing",
    versionIds: versions,
  }),
  { ok: false, reason: "already_published" }
);
ok("a publish already in flight is rejected");

// Only a settled draft is safe to delete: the other states may already have a
// registration on AgentPlanet.
assert.equal(deletableState("draft"), true);
assert.equal(deletableState("publishing"), false);
assert.equal(deletableState("published"), false);
assert.equal(deletableState("unpublishing"), false);
ok("only a settled draft may be deleted");

// Withdrawing makes an asset a draft again, so the licence rows are what would
// disappear with it; they are the record that a grant happened.
assert.equal(blocksAssetDelete(0), false);
assert.equal(blocksAssetDelete(1), true);
ok("a licensed asset cannot be deleted even once withdrawn");

assert.deepEqual(
  checkPublishable({ type: "MYSTERY", publishState: "draft", versionIds: versions }),
  { ok: false, reason: "unknown_type" }
);
ok("an unregistrable type cannot be published");

assert.equal(blocksProjectDelete(0), false);
assert.equal(blocksProjectDelete(2), true);
ok("a project with published assets cannot be deleted out from under buyers");

// Publishing claims ownership, so it is not the project owner's to do on a
// contributor's work — agents keep what they contributed to a PUBLIC entry.
const me = "auth0|me";
assert.equal(
  canPublishAsAuthor({
    authorUserId: me,
    authorAgentId: null,
    authorKey: `user:${me}`,
    projectVisibility: "PUBLIC",
    publisherSub: me,
  }),
  true
);
assert.equal(
  canPublishAsAuthor({
    authorUserId: "auth0|someone-else",
    authorAgentId: null,
    authorKey: "user:auth0|someone-else",
    projectVisibility: "PUBLIC",
    publisherSub: me,
  }),
  false
);
assert.equal(
  canPublishAsAuthor({
    authorUserId: null,
    authorAgentId: "agent-contributor",
    authorKey: "agent:agent-contributor",
    projectVisibility: "PUBLIC",
    publisherSub: me,
  }),
  false,
  "an agent's contribution is not the project owner's to sell"
);

// `legacy` means authorship predates the field, not that the owner made it.
assert.equal(
  canPublishAsAuthor({
    authorUserId: null,
    authorAgentId: null,
    authorKey: "legacy",
    projectVisibility: "PRIVATE",
    publisherSub: me,
  }),
  true
);
assert.equal(
  canPublishAsAuthor({
    authorUserId: null,
    authorAgentId: null,
    authorKey: "legacy",
    projectVisibility: "PUBLIC",
    publisherSub: me,
  }),
  false,
  "a pre-authorship row on a PUBLIC entry may be an agent contribution"
);
ok("only the author may publish; legacy rows are claimable only in PRIVATE");

// An agent publishes its own work and nothing else. A Studio key does not
// stand in for it: publishing opens the asset to licensing, which is the
// owner's call.
assert.equal(
  agentCanPublish({
    authorAgentId: "agent-a",
    actor: { kind: "agent", agentId: "agent-a" },
  }),
  true
);
assert.equal(
  agentCanPublish({
    authorAgentId: "agent-a",
    actor: { kind: "agent", agentId: "agent-b" },
  }),
  false
);
assert.equal(
  agentCanPublish({
    authorAgentId: "agent-a",
    actor: { kind: "studio_key" },
  }),
  false
);
assert.equal(
  agentCanPublish({
    authorAgentId: null,
    actor: { kind: "agent", agentId: "agent-a" },
  }),
  false
);
ok("an agent publishes only what it authored, and ops cannot do it for them");

console.log("\nAll asset publish checks passed.");
