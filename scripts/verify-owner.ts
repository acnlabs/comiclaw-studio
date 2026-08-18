/**
 * Offline checks for create-time project ownership.
 * Run: npx tsx scripts/verify-owner.ts
 */
import assert from "node:assert/strict";
import {
  createOwnerAssignmentError,
  hasSettledOwner,
  ownerEqualsWhere,
  ownersMatch,
  resolveCreateOwner,
} from "../src/lib/owner";
import { authorLine } from "../src/lib/authorLine";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

assert.deepEqual(
  resolveCreateOwner({ actor: { kind: "user", userId: "auth0|me" } }),
  { ownerKind: "user", ownerUserId: "auth0|me", ownerAgentId: null, ownerOrgId: null },
);
ok("a human-created project belongs to that human");

assert.deepEqual(
  resolveCreateOwner({
    actor: { kind: "agent", agentId: "agent-comiclaw" },
    requested: { userId: "auth0|client" },
  }),
  { ownerKind: "user", ownerUserId: "auth0|client", ownerAgentId: null, ownerOrgId: null },
);
ok("an agent making a film for a human still belongs to the human");

assert.deepEqual(
  resolveCreateOwner({ actor: { kind: "agent", agentId: "agent-star" } }),
  { ownerKind: "agent", ownerUserId: null, ownerAgentId: "agent-star", ownerOrgId: null },
);
ok("an agent creating for itself owns the project");

assert.deepEqual(
  resolveCreateOwner({
    actor: { kind: "agent", agentId: "agent-steward" },
    requested: { kind: "org", orgId: "org_abc" },
  }),
  { ownerKind: "org", ownerUserId: null, ownerAgentId: null, ownerOrgId: "org_abc" },
);
ok("an org-created project belongs to the org, not the acting agent");

assert.equal(
  createOwnerAssignmentError(
    { ownerKind: "agent", ownerUserId: null, ownerAgentId: "agent-other", ownerOrgId: null },
    { kind: "agent", agentId: "agent-star" },
  ),
  "An agent cannot assign another agent as owner",
);
ok("an agent cannot assign another agent as owner");

assert.equal(
  createOwnerAssignmentError(
    { ownerKind: "agent", ownerUserId: null, ownerAgentId: "agent-star", ownerOrgId: null },
    { kind: "agent", agentId: "agent-star" },
  ),
  null,
);
ok("an agent may assign itself as owner");

assert.equal(
  createOwnerAssignmentError(
    { ownerKind: "org", ownerUserId: null, ownerAgentId: null, ownerOrgId: "org_abc" },
    { kind: "agent", agentId: "agent-star" },
  ),
  "ORG_MEMBERSHIP_REQUIRED",
);
ok("assigning an org as owner requires membership unless just created");

assert.equal(
  createOwnerAssignmentError(
    { ownerKind: "org", ownerUserId: null, ownerAgentId: null, ownerOrgId: "org_new" },
    { kind: "agent", agentId: "agent-star" },
    { allowedOrgIds: ["org_new"] },
  ),
  null,
);
ok("an agent that just created an org may assign it as owner");

assert.equal(
  createOwnerAssignmentError(
    { ownerKind: "agent", ownerUserId: null, ownerAgentId: "anyone", ownerOrgId: null },
    { kind: "studio_key" },
  ),
  null,
);
ok("studio key may assign any owner");

assert.equal(
  hasSettledOwner({
    ownerKind: "agent",
    ownerUserId: null,
    ownerAgentId: "agent-star",
    ownerOrgId: null,
  }),
  true,
);
ok("an agent-owned private project is already owned");

assert.equal(
  hasSettledOwner({
    ownerKind: "agent",
    ownerUserId: null,
    ownerAgentId: null,
    ownerOrgId: null,
  }),
  false,
);
ok("a legacy unclaimed private project is still claimable");

assert.equal(
  hasSettledOwner({
    ownerKind: "org",
    ownerUserId: null,
    ownerAgentId: null,
    ownerOrgId: "org_abc",
  }),
  true,
);
ok("an org-owned project cannot be claimed");

assert.equal(
  ownersMatch(
    { ownerKind: "agent", ownerUserId: null, ownerAgentId: "a1", ownerOrgId: null },
    { ownerKind: "agent", ownerUserId: null, ownerAgentId: "a1", ownerOrgId: null },
  ),
  true,
);
ok("the same agent owner matches for series attach");

assert.deepEqual(
  ownerEqualsWhere({
    ownerKind: "org",
    ownerUserId: null,
    ownerAgentId: null,
    ownerOrgId: "org_abc",
  }),
  { ownerKind: "org", ownerOrgId: "org_abc" },
);
ok("org owner filter does not fall back to ownerUserId");

assert.equal(authorLine({ handle: "daxia", authorName: "漫剧大虾官方" }), "@daxia");
ok("a profile handle is shown as @handle, not the display name");

assert.equal(authorLine({ handle: null, authorName: "漫剧大虾官方" }), "漫剧大虾官方");
ok("a display name without a profile is not prefixed with @");

assert.equal(authorLine({ handle: null, authorName: "Comiclaw" }), "Comiclaw");
ok("an agent or org owner line is the live name, not an @");

console.log("\nAll owner checks passed.");
