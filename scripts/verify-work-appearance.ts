/**
 * Offline checks for agent cast credits.
 * Run: npx tsx scripts/verify-work-appearance.ts
 */
import assert from "node:assert/strict";
import { applyLiveCreditNames } from "../src/lib/authorLine";
import { feedCastCredits, toAppearanceCredits } from "../src/lib/workAppearance";
import { feedCredits, listedCredits, mergeCredits } from "../src/lib/workCredit";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

const credits = toAppearanceCredits([
  { agentId: "cast-2", displayName: "小智", role: "cast" },
  { agentId: "cast-3", displayName: " Mira ", role: "cast" },
  { agentId: "lead-1", displayName: "大虾队长", role: "lead" },
  { agentId: "lead-1", displayName: "duplicate", role: "cast" },
]);
assert.equal(credits.length, 3);
assert.equal(credits[0].href, "/agents/lead-1");
assert.equal(credits[0].role, "lead");
assert.equal(credits[0].displayName, "大虾队长");
assert.equal(credits[2].displayName, "Mira");
ok("appearance credits de-dupe agents and put the lead first");

const feed = feedCastCredits(credits, null);
assert.deepEqual(
  feed.visible.map((row) => row.agentId),
  ["lead-1", "cast-2"],
);
assert.equal(feed.extra, 1);
ok("the feed shows two names and hides the rest as extra");

const withoutOwner = feedCastCredits(credits, "lead-1");
assert.deepEqual(
  withoutOwner.visible.map((row) => row.agentId),
  ["cast-2", "cast-3"],
);
assert.equal(withoutOwner.extra, 0);
ok("an agent owner is not repeated in the feed cast line");

const crew = mergeCredits([
  { agentId: "writer", kind: "script", displayName: "CodeHelper" },
  { agentId: "lead-1", kind: "appear", role: "lead", displayName: "Comiclaw" },
  { agentId: "writer", kind: "appear", role: "cast", displayName: "CodeHelper" },
]);
assert.equal(crew[0].agentId, "lead-1");
assert.deepEqual(crew[1].kinds, ["appear", "script"]);
assert.equal(feedCredits(crew, "lead-1").length, 1);
ok("credits merge appear and crew labels on the same agent");

const watch = listedCredits({
  ownerKind: "user",
  credits: [
    { agentId: "lead-1", kind: "appear", role: "lead", displayName: "Comiclaw" },
    { agentId: "writer", kind: "script", displayName: "CodeHelper" },
  ],
});
assert.deepEqual(
  watch.map((row) => [row.agentId, row.kinds.join("+")]),
  [
    ["lead-1", "appear"],
    ["writer", "script"],
  ],
);
ok("the watch page lists appear and crew from the same credit set as the feed");

const live = applyLiveCreditNames(
  [
    { agentId: "a1", displayName: "上架时的字" },
    { agentId: "a2", displayName: "a2" },
  ],
  new Map([["a1", "Comiclaw"]]),
);
assert.equal(live[0].displayName, "Comiclaw");
assert.equal(live[1].displayName, "a2");
assert.ok(!live[0].displayName.startsWith("@"));
ok("credit names prefer the live ACN name and do not invent an @");

console.log("\nAll appearance checks passed.");
