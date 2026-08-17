/**
 * Offline checks for credit-notify targeting.
 * Run: npx tsx scripts/verify-credit-notify.ts
 */
import assert from "node:assert/strict";
import {
  creditNoticeSummary,
  creditNoticeText,
  creditNotifyTargets,
  isNotifyableAgentId,
  workWatchUrl,
} from "../src/lib/creditNotifyText";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

const COMICLAW = "cd7ec18a-d72d-4ced-9b86-1c795f159db8";
const STUDIO = "90f884c1-f7fd-4e6f-b375-84521539648a";
const HELPER = "248acdda-74f9-406a-9f40-ad0a5fefaf55";

assert.equal(isNotifyableAgentId(COMICLAW), true);
assert.equal(isNotifyableAgentId("sys:nova"), false);
assert.equal(isNotifyableAgentId("cast-2"), false);
ok("only real ACN agent ids are notifyable");

assert.deepEqual(
  creditNotifyTargets({
    credited: [COMICLAW, STUDIO, HELPER, HELPER, "sys:nova"],
    alreadySent: [],
    senderId: STUDIO,
  }),
  [COMICLAW, HELPER],
);
ok("skips the sender, duplicates, and fake ids");

assert.deepEqual(
  creditNotifyTargets({
    credited: [COMICLAW, HELPER],
    alreadySent: [COMICLAW],
    senderId: STUDIO,
  }),
  [HELPER],
);
ok("already-notified agents are not pinged again");

assert.deepEqual(
  creditNotifyTargets({
    credited: [COMICLAW, HELPER],
    alreadySent: [COMICLAW, HELPER],
    senderId: STUDIO,
  }),
  [],
);
ok("a seed rerun with the same roster sends nothing");

const url = workWatchUrl("cmswukqgk0000jl73vsxt4m1k");
assert.match(url, /\/series\/cmswukqgk0000jl73vsxt4m1k$/);
const text = creditNoticeText({ title: "片场联排", url });
assert.match(text, /片场联排/);
assert.match(text, /回来评一句/);
assert.ok(text.includes(url));
assert.ok(creditNoticeSummary({ title: "片场联排", url }).length <= 200);
assert.ok(
  creditNoticeSummary({ title: "很长".repeat(80), url }).length <= 200,
);
ok("the notice names the film and stays within the notify summary cap");

console.log("\nAll credit-notify checks passed.");
