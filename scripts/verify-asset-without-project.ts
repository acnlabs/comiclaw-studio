/**
 * Offline checks for content that belongs to no project.
 * Run: npx tsx scripts/verify-asset-without-project.ts
 */
import assert from "node:assert/strict";
import { canDeleteContent, canMutateContent } from "../src/lib/contentAuth";
import { canPublishAsAuthor } from "../src/lib/assetPublish";
import { LEGACY_AUTHOR_KEY } from "../src/lib/authorKey";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

const byHuman = {
  authorUserId: "auth0|maker",
  authorAgentId: null,
  authorKey: "user:auth0|maker",
};
const byAgent = {
  authorUserId: null,
  authorAgentId: "agent-alice",
  authorKey: "agent:agent-alice",
};
const preAuthorship = {
  authorUserId: null,
  authorAgentId: null,
  authorKey: LEGACY_AUTHOR_KEY,
};

// Every other rule reasons from the container: the project owner may edit
// their project's content, ops may clean up a delivery project. With no
// container none of that is inherited.
assert.equal(canMutateContent(byHuman, null, { kind: "user", sub: "auth0|maker" }), true);
assert.equal(canMutateContent(byHuman, null, { kind: "user", sub: "auth0|other" }), false);
assert.equal(
  canMutateContent(byAgent, null, { kind: "acn_agent", agentId: "agent-alice" }),
  true
);
assert.equal(
  canMutateContent(byAgent, null, { kind: "acn_agent", agentId: "agent-bob" }),
  false
);
ok("without a project, only the author may edit");

// The blanket ops delete exists because a delivery project is ComicLaw's to
// run. An asset outside any project is not.
assert.equal(canDeleteContent(byHuman, null, { kind: "studio_key" }), false);
assert.equal(canMutateContent(byHuman, null, { kind: "studio_key" }), false);
assert.equal(
  canDeleteContent(byHuman, { ownerUserId: "auth0|owner", visibility: "PRIVATE" }, {
    kind: "studio_key",
  }),
  true,
  "inside a project the ops delete still stands"
);
ok("the Studio key's blanket delete does not reach outside a project");

// A legacy row has no author to check against, so there is nobody it could
// belong to — better refused than handed to whoever asks first.
assert.equal(
  canMutateContent(preAuthorship, null, { kind: "user", sub: "auth0|maker" }),
  false
);
assert.equal(canDeleteContent(preAuthorship, null, { kind: "studio_key" }), false);
ok("a pre-authorship row outside a project belongs to nobody");

// Publishing: same reasoning, plus the legacy claim that a PRIVATE delivery
// project allows has no equivalent here.
assert.equal(
  canPublishAsAuthor({
    ...byHuman,
    projectVisibility: null,
    publisherSub: "auth0|maker",
  }),
  true
);
assert.equal(
  canPublishAsAuthor({
    ...byHuman,
    projectVisibility: null,
    publisherSub: "auth0|other",
  }),
  false
);
assert.equal(
  canPublishAsAuthor({
    ...preAuthorship,
    projectVisibility: null,
    publisherSub: "auth0|anyone",
  }),
  false
);
assert.equal(
  canPublishAsAuthor({
    ...preAuthorship,
    projectVisibility: "PRIVATE",
    publisherSub: "auth0|owner",
  }),
  true,
  "inside a PRIVATE delivery project a legacy row is still the owner's own work"
);
ok("publishing an uncontained asset needs a real author");

console.log("\nAll uncontained-asset checks passed.");
