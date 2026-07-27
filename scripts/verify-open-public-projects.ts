/**
 * Offline verification for open public project helpers (no DB).
 * Run: npx tsx scripts/verify-open-public-projects.ts
 */
import assert from "node:assert/strict";
import {
  canViewProject,
  canUserContribute,
  assertPrivacyAllowed,
} from "../src/lib/projectAccess";
import {
  canMutateContent,
  canDeleteContent,
  actorFromProductionAuth,
} from "../src/lib/contentAuth";
import {
  authorFromUser,
  authorFromAgent,
  resolveAgentCreateAuthor,
  LEGACY_AUTHOR_KEY,
} from "../src/lib/contentAuthor";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

// --- projectAccess ---
assert.equal(
  canViewProject(
    { visibility: "PUBLIC", isPrivate: false, ownerUserId: "u1" },
    null
  ),
  true
);
ok("PUBLIC viewable anonymously");

assert.equal(
  canViewProject(
    { visibility: "PRIVATE", isPrivate: true, ownerUserId: "u1" },
    null
  ),
  false
);
ok("PRIVATE+isPrivate blocked for anonymous");

assert.equal(
  canViewProject(
    { visibility: "PRIVATE", isPrivate: true, ownerUserId: "u1" },
    "u1"
  ),
  true
);
ok("PRIVATE+isPrivate ok for owner");

assert.equal(
  canUserContribute(
    { visibility: "PUBLIC", isPrivate: false, ownerUserId: null },
    "u2"
  ),
  true
);
ok("any user can contribute to PUBLIC");

assert.equal(
  canUserContribute(
    { visibility: "PRIVATE", isPrivate: false, ownerUserId: "u1" },
    "u2"
  ),
  false
);
ok("non-owner cannot contribute to PRIVATE");

assert.ok(assertPrivacyAllowed("PUBLIC", true) instanceof Response);
ok("PUBLIC cannot enable isPrivate");

assert.equal(assertPrivacyAllowed("PRIVATE", true), null);
ok("PRIVATE can enable isPrivate");

// --- contentAuthor ---
const userA = authorFromUser("auth0|a");
const agentW = authorFromAgent("agent-w");
assert.equal(userA.authorKey, "user:auth0|a");
assert.equal(agentW.authorKey, "agent:agent-w");
ok("author keys");

const workerAuth = resolveAgentCreateAuthor({
  auth: { kind: "acn_worker", agentId: "agent-w", acnTaskId: "t1" },
  visibility: "PUBLIC",
});
assert.ok(!(workerAuth instanceof Response));
assert.equal(workerAuth.authorKey, "agent:agent-w");
ok("worker signs as self on PUBLIC");

const studioPublicNoAuthor = resolveAgentCreateAuthor({
  auth: { kind: "studio_key" },
  visibility: "PUBLIC",
});
assert.ok(studioPublicNoAuthor instanceof Response);
ok("studio_key on PUBLIC requires explicit author");

const studioPrivateLegacy = resolveAgentCreateAuthor({
  auth: { kind: "studio_key" },
  visibility: "PRIVATE",
});
assert.ok(!(studioPrivateLegacy instanceof Response));
assert.equal(studioPrivateLegacy.authorKey, LEGACY_AUTHOR_KEY);
ok("studio_key on PRIVATE may use legacy");

const forged = resolveAgentCreateAuthor({
  auth: { kind: "acn_worker", agentId: "agent-w", acnTaskId: "t1" },
  visibility: "PUBLIC",
  authorAgentId: "agent-other",
});
assert.ok(forged instanceof Response);
ok("worker cannot forge another agent author");

// --- contentAuth ---
const project = { ownerUserId: "owner" };
const userContent = {
  authorUserId: "auth0|a",
  authorAgentId: null,
  authorKey: "user:auth0|a",
};
const agentContent = {
  authorUserId: null,
  authorAgentId: "agent-w",
  authorKey: "agent:agent-w",
};
const legacyContent = {
  authorUserId: null,
  authorAgentId: null,
  authorKey: LEGACY_AUTHOR_KEY,
};

assert.equal(
  canMutateContent(userContent, project, { kind: "user", sub: "auth0|a" }),
  true
);
assert.equal(
  canMutateContent(userContent, project, { kind: "user", sub: "auth0|b" }),
  false
);
assert.equal(
  canMutateContent(userContent, project, {
    kind: "acn_agent",
    agentId: "agent-w",
  }),
  false
);
ok("users edit only own; agent cannot edit user content");

assert.equal(
  canMutateContent(agentContent, project, {
    kind: "acn_agent",
    agentId: "agent-w",
  }),
  true
);
assert.equal(
  canMutateContent(agentContent, project, { kind: "user", sub: "auth0|a" }),
  false
);
ok("agent edits only own; user cannot edit agent content");

assert.equal(
  canMutateContent(userContent, project, { kind: "studio_key" }),
  false
);
assert.equal(
  canDeleteContent(userContent, project, { kind: "studio_key" }),
  true
);
ok("studio_key: no blanket PATCH, DELETE allowed");

assert.equal(
  canMutateContent(legacyContent, project, { kind: "user", sub: "owner" }),
  true
);
assert.equal(
  canMutateContent(legacyContent, project, { kind: "studio_key" }),
  true
);
ok("legacy content editable by owner / studio_key");

assert.deepEqual(actorFromProductionAuth({ kind: "studio_key" }), {
  kind: "studio_key",
});
assert.deepEqual(
  actorFromProductionAuth({
    kind: "acn_worker",
    agentId: "agent-w",
    acnTaskId: "t",
  } as { kind: "acn_worker"; agentId: string }),
  { kind: "acn_agent", agentId: "agent-w" }
);
ok("actorFromProductionAuth mapping");

console.log("\nAll open-public-projects helper checks passed.");
