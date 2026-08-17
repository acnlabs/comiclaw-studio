/**
 * Offline checks for YouTube OAuth state, token box, and publish gates.
 * Run: npx tsx scripts/verify-youtube-publish.ts
 */
import assert from "node:assert/strict";
import {
  decryptSecret,
  encryptSecret,
  sanitizeYoutubeReturnTo,
  signYoutubeOAuthState,
  verifyYoutubeOAuthState,
} from "../src/lib/youtubeCrypto";
import {
  buildYoutubeSnippet,
  checkYoutubePublishable,
  resolveYoutubeAccountOwner,
  youtubeWatchUrl,
} from "../src/lib/youtubePublish";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

const secret = "youtube-token-secret-for-tests";

const packed = encryptSecret("refresh-token-value", secret);
assert.notEqual(packed, "refresh-token-value");
assert.equal(decryptSecret(packed, secret), "refresh-token-value");
assert.notEqual(encryptSecret("refresh-token-value", secret), packed);
ok("refresh tokens are encrypted with a fresh nonce");

assert.throws(() => decryptSecret(packed, "wrong-secret-value!!"));
ok("a wrong secret cannot open the box");

assert.equal(sanitizeYoutubeReturnTo("/p/abc"), "/p/abc");
assert.equal(sanitizeYoutubeReturnTo("/studio"), "/studio");
assert.equal(sanitizeYoutubeReturnTo("https://evil.example/p/x"), "/studio");
assert.equal(sanitizeYoutubeReturnTo("//evil.example"), "/studio");
assert.equal(sanitizeYoutubeReturnTo("/admin"), "/studio");
ok("OAuth returnTo only allows /p/… and /studio");

const now = 1_700_000_000_000;
const state = signYoutubeOAuthState({
  sub: "auth0|owner",
  returnTo: "/p/share",
  now,
  secret,
});
assert.deepEqual(verifyYoutubeOAuthState({ state, secret, now: now + 1000 }), {
  sub: "auth0|owner",
  returnTo: "/p/share",
  exp: now + 15 * 60 * 1000,
});
assert.equal(verifyYoutubeOAuthState({ state, secret, now: now + 16 * 60 * 1000 }), null);
assert.equal(verifyYoutubeOAuthState({ state: state + "x", secret, now }), null);
assert.equal(
  verifyYoutubeOAuthState({ state, secret: "other-secret-value!", now }),
  null,
);
ok("OAuth state is signed, bound to the user, and expires");

assert.deepEqual(
  resolveYoutubeAccountOwner({ ownerKind: "user", ownerUserId: "auth0|a" }),
  { ok: true, ownerUserId: "auth0|a" },
);
assert.deepEqual(
  resolveYoutubeAccountOwner({ ownerKind: "agent", ownerUserId: null }),
  { ok: false, reason: "not_user_owned" },
);
assert.deepEqual(
  resolveYoutubeAccountOwner({ ownerKind: "org", ownerUserId: null }),
  { ok: false, reason: "not_user_owned" },
);
ok("YouTube publish is keyed to a human project owner");

assert.deepEqual(
  checkYoutubePublishable({
    configured: false,
    ownerUserId: "auth0|a",
    connected: true,
    hasFilm: true,
  }),
  { ok: false, reason: "not_configured" },
);
assert.deepEqual(
  checkYoutubePublishable({
    configured: true,
    ownerUserId: null,
    connected: false,
    hasFilm: true,
  }),
  { ok: false, reason: "not_user_owned" },
);
assert.deepEqual(
  checkYoutubePublishable({
    configured: true,
    ownerUserId: "auth0|a",
    connected: true,
    hasFilm: false,
  }),
  { ok: false, reason: "no_film" },
);
assert.deepEqual(
  checkYoutubePublishable({
    configured: true,
    ownerUserId: "auth0|a",
    connected: false,
    hasFilm: true,
  }),
  { ok: false, reason: "not_connected" },
);
assert.deepEqual(
  checkYoutubePublishable({
    configured: true,
    ownerUserId: "auth0|a",
    connected: true,
    hasFilm: true,
  }),
  { ok: true },
);
ok("publish gates fail closed in a stable order");

const short = buildYoutubeSnippet({
  title: "  Launch  ",
  description: "A 15s pitch",
  durationSec: 15,
});
assert.equal(short.title, "Launch");
assert.match(short.description, /#Shorts/);
assert.match(short.description, /AI-generated imagery/);

const long = buildYoutubeSnippet({
  title: "x".repeat(140),
  description: "Already mentions AI-generated imagery.",
  durationSec: 400,
});
assert.equal(long.title.length, 100);
assert.doesNotMatch(long.description, /#Shorts/);
ok("titles are capped and Shorts / AI disclosure are added only when needed");

assert.equal(youtubeWatchUrl("abc123"), "https://www.youtube.com/watch?v=abc123");
ok("watch URLs are stable");

console.log("\nAll YouTube publish checks passed.");
