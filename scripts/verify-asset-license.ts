/**
 * Offline checks for licensing a published asset into a project.
 * Run: npx tsx scripts/verify-asset-license.ts
 */
import assert from "node:assert/strict";
import { checkLicensable, copyAuthorFor } from "../src/lib/assetLicense";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

const me = "auth0|me";
const base = {
  publishState: "published",
  publishedVersionId: "v1",
  projectOwnerUserId: me,
  requesterSub: me,
};

assert.deepEqual(checkLicensable(base), { ok: true });
ok("a published asset can be licensed into your own project");

// Only published assets are on offer; drafts and in-flight ones are not.
for (const state of ["draft", "publishing", "unpublishing"]) {
  assert.deepEqual(checkLicensable({ ...base, publishState: state }), {
    ok: false,
    reason: "not_published",
  });
}
ok("unpublished and in-flight assets cannot be licensed");

// Published without a pinned version would hand the buyer nothing.
assert.deepEqual(
  checkLicensable({ ...base, publishedVersionId: null }),
  { ok: false, reason: "no_pinned_version" }
);
ok("a published asset with no pinned version is refused");

assert.deepEqual(
  checkLicensable({ ...base, projectOwnerUserId: "auth0|someone-else" }),
  { ok: false, reason: "not_your_project" }
);
assert.deepEqual(
  checkLicensable({ ...base, projectOwnerUserId: null }),
  { ok: false, reason: "not_your_project" }
);
ok("you can only license into a project you own");

assert.deepEqual(
  checkLicensable({ ...base, existingStatus: "GRANTED" }),
  { ok: false, reason: "already_licensed" }
);
ok("licensing the same asset into the same project twice is refused");

// A payment that never completed must not block a retry.
assert.deepEqual(
  checkLicensable({ ...base, existingStatus: "PENDING_PAYMENT" }),
  { ok: true }
);
ok("a stuck pending payment does not block licensing");

// The copy is attributed so edit-own works on a co-creation entry.
assert.deepEqual(
  copyAuthorFor({ projectVisibility: "PUBLIC", licenseeSub: me }),
  { authorUserId: me, authorAgentId: null, authorKey: `user:${me}` }
);
// A delivery project stays on the pre-authorship marker so workers can iterate.
assert.deepEqual(
  copyAuthorFor({ projectVisibility: "PRIVATE", licenseeSub: me }),
  { authorUserId: null, authorAgentId: null, authorKey: "legacy" }
);
ok("the copy is attributed on PUBLIC and left legacy on PRIVATE");

console.log("\nAll asset license checks passed.");
