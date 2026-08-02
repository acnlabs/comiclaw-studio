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
import { assertHumanContributePolicy } from "../src/lib/orgBinding";

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
  canUserContribute(
    { visibility: "PUBLIC", isPrivate: false, ownerUserId: null },
    "u2"
  ),
  true
);
ok("any user can contribute to PUBLIC");

assert.ok(assertPrivacyAllowed("PUBLIC", true) instanceof Response);
ok("PUBLIC cannot enable isPrivate");

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

const forged = resolveAgentCreateAuthor({
  auth: { kind: "acn_worker", agentId: "agent-w", acnTaskId: "t1" },
  visibility: "PUBLIC",
  authorAgentId: "agent-other",
});
assert.ok(forged instanceof Response);
ok("worker cannot forge another agent author");

const contributorAuth = resolveAgentCreateAuthor({
  auth: { kind: "acn_contributor", agentId: "agent-c" },
  visibility: "PUBLIC",
});
assert.ok(!(contributorAuth instanceof Response));
assert.equal(contributorAuth.authorKey, "agent:agent-c");
ok("acn_contributor signs as self on PUBLIC without task");

const contributorForge = resolveAgentCreateAuthor({
  auth: { kind: "acn_contributor", agentId: "agent-c" },
  visibility: "PUBLIC",
  authorAgentId: "agent-other",
});
assert.ok(contributorForge instanceof Response);
ok("acn_contributor cannot forge another agent author");

// --- contentAuth: PRIVATE keeps classic full access ---
const privateProject = { ownerUserId: "owner", visibility: "PRIVATE" };
const publicProject = { ownerUserId: "owner", visibility: "PUBLIC" };
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
  canMutateContent(legacyContent, privateProject, {
    kind: "acn_agent",
    agentId: "agent-w",
  }),
  true
);
assert.equal(
  canMutateContent(userContent, privateProject, { kind: "studio_key" }),
  true
);
assert.equal(
  canMutateContent(agentContent, privateProject, {
    kind: "acn_agent",
    agentId: "other",
  }),
  true
);
ok("PRIVATE: studio_key and any task worker can mutate");

assert.equal(
  canMutateContent(userContent, publicProject, { kind: "user", sub: "auth0|a" }),
  true
);
assert.equal(
  canMutateContent(userContent, publicProject, { kind: "user", sub: "auth0|b" }),
  false
);
assert.equal(
  canMutateContent(userContent, publicProject, {
    kind: "acn_agent",
    agentId: "agent-w",
  }),
  false
);
assert.equal(
  canMutateContent(agentContent, publicProject, {
    kind: "acn_agent",
    agentId: "agent-w",
  }),
  true
);
assert.equal(
  canMutateContent(userContent, publicProject, { kind: "studio_key" }),
  false
);
assert.equal(
  canDeleteContent(userContent, publicProject, { kind: "studio_key" }),
  true
);
ok("PUBLIC: edit-own; studio_key DELETE only");

assert.equal(
  canMutateContent(legacyContent, publicProject, { kind: "user", sub: "owner" }),
  true
);
ok("PUBLIC legacy editable by owner");

assert.deepEqual(actorFromProductionAuth({ kind: "studio_key" }), {
  kind: "studio_key",
});
assert.deepEqual(
  actorFromProductionAuth({ kind: "acn_contributor", agentId: "agent-c" }),
  { kind: "acn_agent", agentId: "agent-c" }
);
ok("actorFromProductionAuth mapping (incl. acn_contributor)");

// --- human contribute policy ---
assert.equal(
  assertHumanContributePolicy({
    effective: {
      acnOrgId: "org_x",
      contributePolicy: "owner_only",
      source: "column",
      editorAgentId: null,
    },
    project: { visibility: "PUBLIC", ownerUserId: "owner" },
    sub: "other",
  }) instanceof Response,
  true
);
ok("owner_only blocks non-owner humans");

assert.equal(
  assertHumanContributePolicy({
    effective: {
      acnOrgId: "org_x",
      contributePolicy: "org_members",
      source: "column",
      editorAgentId: null,
    },
    project: { visibility: "PUBLIC", ownerUserId: "owner" },
    sub: "other",
  }),
  null
);
ok("org_members allows humans via Studio visibility (not OrgMembership)");

console.log("\nAll open-public-projects helper checks passed.");
