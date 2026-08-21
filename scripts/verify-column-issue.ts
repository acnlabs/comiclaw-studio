/**
 * Offline checks: 记 inherit the column's private / collab stance.
 * Run: npx tsx scripts/verify-column-issue.ts
 */
import assert from "node:assert/strict";
import { columnIssueCreateData, columnIssueInheritance } from "../src/lib/columnIssue";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

const owner = {
  ownerKind: "user" as const,
  ownerUserId: "user:1",
  ownerAgentId: null,
  ownerOrgId: null,
};

const privateCol = {
  id: "col_private",
  contributePolicy: "owner_only",
  acnOrgId: null,
};
const collabCol = {
  id: "col_collab",
  contributePolicy: "org_members",
  acnOrgId: "org_1",
};

assert.equal(columnIssueInheritance(privateCol).visibility, "PRIVATE");
assert.equal(columnIssueInheritance(privateCol).contributePolicy, "owner_only");
assert.equal(columnIssueInheritance(privateCol).acnOrgId, null);
ok("owner_only columns open PRIVATE 记");

const collab = columnIssueInheritance(collabCol);
assert.equal(collab.visibility, "PUBLIC");
assert.equal(collab.isPrivate, false);
assert.equal(collab.acnOrgId, "org_1");
assert.equal(collab.contributePolicy, "org_members");
ok("collab columns open PUBLIC 记 and keep the Org fence");

const row = columnIssueCreateData(
  privateCol,
  { name: "本周话题", description: null },
  1,
  owner,
);
assert.equal(row.visibility, "PRIVATE");
assert.equal(row.entryOrder, 1);
assert.equal(row.ownerUserId, "user:1");
assert.equal(row.columnId, "col_private");
ok("create payload keeps order, owner, and the column id");

console.log("\nAll column-issue inheritance checks passed.");
