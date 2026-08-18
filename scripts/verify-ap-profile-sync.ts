/**
 * Offline checks for AgentPlanet → Studio identity copy.
 * Run: npx tsx scripts/verify-ap-profile-sync.ts
 */
import assert from "node:assert/strict";
import {
  isGenericDisplayName,
  nextUserProfileFromAgentPlanet,
  pickAgentPlanetDisplayName,
  pickAgentPlanetHandle,
} from "../src/lib/agentPlanetUser";
import { isFallbackHandle, isSeedUserId } from "../src/lib/userHandle";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

assert.equal(isSeedUserId("seed:daxia"), true);
assert.equal(isSeedUserId("auth0|abc"), false);
assert.equal(isFallbackHandle("u-38rkary"), true);
assert.equal(isFallbackHandle("daxia"), false);
ok("seed accounts and generated handles are recognized");

assert.equal(pickAgentPlanetDisplayName({ display_name: "漫剧大虾", name: "OAuth" }), "漫剧大虾");
assert.equal(pickAgentPlanetDisplayName({ display_name: null, name: "Alice" }), "Alice");
assert.equal(pickAgentPlanetDisplayName({ display_name: "微信用户", name: "Alice" }), "Alice");
assert.equal(
  pickAgentPlanetDisplayName({ display_name: "auth0|x", name: "用户·abcd" }, "auth0|x"),
  null,
);
assert.equal(isGenericDisplayName("WeChat User"), true);
ok("display names skip placeholders and fall back to the real AP name");

assert.equal(pickAgentPlanetHandle("Daxia"), "daxia");
assert.equal(pickAgentPlanetHandle("@Mira"), "mira");
assert.equal(pickAgentPlanetHandle("Hermes Task Miner"), null);
assert.equal(pickAgentPlanetHandle("studio"), null);
ok("only a real short name can become a handle");

assert.deepEqual(
  nextUserProfileFromAgentPlanet({
    userId: "auth0|me",
    handle: "u-38rkary",
    displayName: null,
    remote: { displayName: "Alice", username: "alice" },
  }),
  { handle: "alice", displayName: "Alice" },
);
ok("a generated handle is replaced by the AP username");

assert.deepEqual(
  nextUserProfileFromAgentPlanet({
    userId: "auth0|me",
    handle: "alice",
    displayName: "Old",
    remote: { displayName: "Alice", username: null },
  }),
  { handle: "alice", displayName: "Alice" },
);
ok("without an AP username the local handle stays, display name updates");

assert.deepEqual(
  nextUserProfileFromAgentPlanet({
    userId: "seed:daxia",
    handle: "daxia",
    displayName: "漫剧大虾官方",
    remote: { displayName: "Someone", username: "alice" },
  }),
  { handle: "daxia", displayName: "漫剧大虾官方" },
);
ok("the official seed profile is not overwritten");

console.log("\nAll AgentPlanet profile sync checks passed.");
