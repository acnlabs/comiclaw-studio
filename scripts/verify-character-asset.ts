/**
 * Offline checks for the Asset that backs a marketplace character.
 * Run: npx tsx scripts/verify-character-asset.ts
 */
import assert from "node:assert/strict";
import { artworkChanged, backingAssetInput } from "../src/lib/characterAsset";
import { LEGACY_AUTHOR_KEY } from "../src/lib/authorKey";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

const base = {
  name: "面馆老板",
  tagline: "只在夜里营业的老板。",
  imageUrl: "https://example.com/a.png",
  audioUrl: null,
};

assert.deepEqual(
  backingAssetInput({ ...base, ownerUserId: "auth0|maker", acnAgentId: "agent-x" }),
  {
    type: "CHARACTER",
    name: "面馆老板",
    description: "只在夜里营业的老板。",
    authorUserId: "auth0|maker",
    authorAgentId: null,
    authorKey: "user:auth0|maker",
    version: { imageUrl: "https://example.com/a.png", audioUrl: null },
  }
);
ok("a character with a human owner is authored by that human");

// The acting agent is the author only when there is no human behind it —
// playing a character and owning it are different things.
assert.deepEqual(
  backingAssetInput({ ...base, ownerUserId: null, acnAgentId: "agent-x" }).authorAgentId,
  "agent-x"
);
assert.equal(
  backingAssetInput({ ...base, ownerUserId: null, acnAgentId: null }).authorKey,
  LEGACY_AUTHOR_KEY
);
ok("an unattributable character stays legacy rather than being given away");

// Artwork history: a replaced image becomes a new take, so the version a
// licensee pinned keeps showing what they paid for.
assert.equal(artworkChanged(null, base), true, "no version yet");
assert.equal(
  artworkChanged({ imageUrl: base.imageUrl, audioUrl: null }, base),
  false
);
assert.equal(
  artworkChanged({ imageUrl: "https://example.com/old.png", audioUrl: null }, base),
  true
);
assert.equal(
  artworkChanged({ imageUrl: base.imageUrl, audioUrl: "https://example.com/v.mp3" }, base),
  true,
  "a changed voice sample is a new take too"
);
ok("replaced artwork is recorded as a new take, not an overwrite");

console.log("\nAll character-asset checks passed.");
