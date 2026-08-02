/**
 * Offline checks for who may start a co-creation project under a 记.
 * Run: npx tsx scripts/verify-derivative-project.ts
 */
import assert from "node:assert/strict";
import { canDeriveFrom, type DerivationParent } from "../src/lib/derivativeProject";

const ok = (label: string) => console.log(`✓ ${label}`);

const entry: DerivationParent = {
  parentProjectId: null,
  columnId: "col_1",
  visibility: "PUBLIC",
};

const stranger = { kind: "user", sub: "auth0|stranger", ownsColumn: false } as const;
const owner = { kind: "user", sub: "auth0|owner", ownsColumn: true } as const;
const clearedAgent = { kind: "agent", gatePassed: true } as const;
const blockedAgent = { kind: "agent", gatePassed: false } as const;

// The point of the horizontal axis: someone who owns nothing here can still
// bring their own project to this 记.
assert.deepEqual(
  canDeriveFrom({ parent: entry, contributePolicy: "open", deriver: stranger }),
  { ok: true }
);
ok("an open column lets any creator start their own project under a 记");

assert.deepEqual(
  canDeriveFrom({ parent: entry, contributePolicy: "open", deriver: clearedAgent }),
  { ok: true }
);
ok("an agent cleared by the contribute gate may derive");

assert.deepEqual(
  canDeriveFrom({ parent: entry, contributePolicy: "org_members", deriver: blockedAgent }),
  { ok: false, reason: "policy_refuses" }
);
ok("an agent the Org gate refused may not derive");

// Humans are not OrgMembership rows, so org_members leaves only the owner.
assert.deepEqual(
  canDeriveFrom({ parent: entry, contributePolicy: "org_members", deriver: stranger }),
  { ok: false, reason: "policy_refuses" }
);
assert.deepEqual(
  canDeriveFrom({ parent: entry, contributePolicy: "org_members", deriver: owner }),
  { ok: true }
);
ok("under org_members a human derives only if they own the column");

assert.deepEqual(
  canDeriveFrom({ parent: entry, contributePolicy: "owner_only", deriver: owner }),
  { ok: false, reason: "policy_refuses" }
);
ok("owner_only closes the horizontal axis entirely, even for the owner");

// Absent policy inherits the org_members default rather than opening up.
assert.deepEqual(
  canDeriveFrom({ parent: entry, contributePolicy: null, deriver: stranger }),
  { ok: false, reason: "policy_refuses" }
);
ok("no policy set falls back to org_members, not to open");

// A 记 must stay one anchor plus a flat list.
assert.deepEqual(
  canDeriveFrom({
    parent: { ...entry, parentProjectId: "prj_anchor" },
    contributePolicy: "open",
    deriver: stranger,
  }),
  { ok: false, reason: "parent_is_derivative" }
);
ok("you derive from the 记, not from another derivative");

assert.deepEqual(
  canDeriveFrom({
    parent: { ...entry, visibility: "PRIVATE" },
    contributePolicy: "open",
    deriver: stranger,
  }),
  { ok: false, reason: "parent_not_public" }
);
assert.deepEqual(
  canDeriveFrom({
    parent: { ...entry, columnId: null },
    contributePolicy: "open",
    deriver: stranger,
  }),
  { ok: false, reason: "parent_not_in_column" }
);
ok("a private project or a project outside a column has no horizontal axis");

// Ops keeps working regardless of policy.
assert.deepEqual(
  canDeriveFrom({
    parent: entry,
    contributePolicy: "owner_only",
    deriver: { kind: "studio_key" },
  }),
  { ok: true }
);
ok("the Studio key is unchanged");

console.log("\nall derivative-project checks passed");
