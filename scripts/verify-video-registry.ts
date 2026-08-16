/**
 * Offline checks for registering a published film as asset_kind=video.
 * Run: npx tsx scripts/verify-video-registry.ts
 */
import assert from "node:assert/strict";
import { registerAssetPayload } from "../src/lib/assetRegistry";
import {
  acceptedBoundAgentId,
  resolveVideoRegistrySubject,
  videoRegisterArgs,
} from "../src/lib/videoRegistryRules";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

const appearing = resolveVideoRegistrySubject({
  appearingAgentId: "agent-star",
  filmAuthorAgentId: "agent-comiclaw",
  projectOwnerUserId: "auth0|owner",
});
assert.deepEqual(appearing, {
  owner: { type: "agent", id: "agent-star" },
  boundAgentId: "agent-star",
});
ok("appearing agent owns the film; ComicLaw is only the producer");

const produced = resolveVideoRegistrySubject({
  filmAuthorAgentId: "agent-comiclaw",
  projectOwnerUserId: "auth0|owner",
});
assert.deepEqual(produced, {
  owner: { type: "agent", id: "agent-comiclaw" },
  boundAgentId: "agent-comiclaw",
});
ok("without an appearing agent, the film author is the registry subject");

const userHeld = resolveVideoRegistrySubject({
  projectOwnerUserId: "auth0|owner",
});
assert.deepEqual(userHeld, {
  owner: { type: "user", id: "auth0|owner" },
  boundAgentId: null,
});
ok("a user-only film registers without a Launch binding");

assert.equal(resolveVideoRegistrySubject({}), null);
ok("no principal means skip, not a forged owner");

const publishedByAgent = resolveVideoRegistrySubject({
  publisherAgentId: "agent-star",
  projectOwnerUserId: "auth0|owner",
});
assert.deepEqual(publishedByAgent, {
  owner: { type: "agent", id: "agent-star" },
  boundAgentId: "agent-star",
});
ok("an explicit publishing agent is used only when no appearing/author agent exists");

const args = videoRegisterArgs({
  workId: "work_001",
  displayName: "15s 介绍",
  subject: appearing!,
});
assert.deepEqual(registerAssetPayload(args), {
  asset_ref: "comiclaw:video:work_001",
  source: "comiclaw-studio",
  asset_kind: "video",
  owner_type: "agent",
  owner_id: "agent-star",
  display_name: "15s 介绍",
  bound_agent_id: "agent-star",
});
ok("published work id is the stable video localId");

assert.equal(
  acceptedBoundAgentId({
    requested: "agent-other",
    inferred: "agent-star",
    publisherAgentId: "agent-comiclaw",
  }),
  "agent-star",
);
ok("workers cannot bind a published film to an unrelated agent");

assert.equal(
  acceptedBoundAgentId({
    requested: "agent-featured",
    inferred: "agent-star",
    allowExplicitBoundAgent: true,
  }),
  "agent-featured",
);
ok("studio key may set an explicit appearing agent");

console.log("\nAll video registry checks passed.");
