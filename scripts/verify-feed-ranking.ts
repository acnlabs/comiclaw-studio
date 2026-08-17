/**
 * Offline checks for the For You ordering.
 * Run: npx tsx scripts/verify-feed-ranking.ts
 */
import assert from "node:assert/strict";
import {
  rankForYou,
  feedTier,
  feedAuthorKey,
  FEATURED_WINDOW_HOURS,
  FRESH_WINDOW_HOURS,
  MAX_AUTHOR_RUN,
} from "../src/lib/feedRanking";

const ok = (label: string) => console.log(`✓ ${label}`);

const NOW = Date.parse("2026-08-02T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

const work = (
  id: string,
  o: {
    featuredAt?: string | null;
    publishedAt: string;
    recentPlays?: number;
    authorKey?: string | null;
  }
) => ({
  id,
  featuredAt: o.featuredAt ?? null,
  publishedAt: o.publishedAt,
  recentPlays: o.recentPlays ?? 0,
  authorKey: o.authorKey,
});

const order = (items: ReturnType<typeof work>[]) =>
  rankForYou(items, NOW).map((w) => w.id);

// An official pick leads even with no plays at all.
assert.deepEqual(
  order([
    work("hot", { publishedAt: hoursAgo(200), recentPlays: 900 }),
    work("picked", { publishedAt: hoursAgo(300), featuredAt: hoursAgo(2) }),
  ]),
  ["picked", "hot"]
);
ok("an official pick outranks the hottest work");

// A pick expires on its own so nobody has to remember to un-pin it.
assert.equal(
  feedTier(work("x", { publishedAt: hoursAgo(300), featuredAt: hoursAgo(FEATURED_WINDOW_HOURS + 1) }), NOW),
  2
);
assert.equal(
  feedTier(work("x", { publishedAt: hoursAgo(300), featuredAt: hoursAgo(FEATURED_WINDOW_HOURS - 1) }), NOW),
  0
);
ok("a pick stops applying once its window passes");

// The cold-start problem: ranking by heat alone would bury every new work,
// because it starts at zero plays and so never earns the views to rise.
assert.deepEqual(
  order([
    work("established", { publishedAt: hoursAgo(500), recentPlays: 400 }),
    work("just-published", { publishedAt: hoursAgo(1) }),
  ]),
  ["just-published", "established"]
);
ok("a work published minutes ago is seen before an established hit");

assert.equal(feedTier(work("x", { publishedAt: hoursAgo(FRESH_WINDOW_HOURS + 1) }), NOW), 2);
ok("once no longer fresh, a work has to earn its place on plays");

// Inside the heat tier, real watching decides.
assert.deepEqual(
  order([
    work("cold", { publishedAt: hoursAgo(100), recentPlays: 3 }),
    work("warm", { publishedAt: hoursAgo(400), recentPlays: 50 }),
  ]),
  ["warm", "cold"]
);
ok("in the heat tier, plays beat recency");

// With no plays anywhere the feed must not become arbitrary — today's
// behaviour (newest first) has to survive as the fallback.
assert.deepEqual(
  order([
    work("older", { publishedAt: hoursAgo(300) }),
    work("newer", { publishedAt: hoursAgo(100) }),
  ]),
  ["newer", "older"]
);
ok("with no plays at all it falls back to newest first");

// Multiple picks: the latest decision leads.
assert.deepEqual(
  order([
    work("picked-earlier", { publishedAt: hoursAgo(300), featuredAt: hoursAgo(40) }),
    work("picked-just-now", { publishedAt: hoursAgo(300), featuredAt: hoursAgo(1) }),
  ]),
  ["picked-just-now", "picked-earlier"]
);
ok("among picks the most recent decision leads");

// Ranking must not mutate what it was given.
const input = [work("a", { publishedAt: hoursAgo(10) }), work("b", { publishedAt: hoursAgo(20) })];
const snapshot = input.map((w) => w.id);
rankForYou(input, NOW);
assert.deepEqual(
  input.map((w) => w.id),
  snapshot
);
ok("ranking leaves the caller's array untouched");

assert.equal(
  feedAuthorKey({
    id: "w1",
    ownerKind: "user",
    ownerUserId: "auth0|me",
    authorName: "display only",
  }),
  "user:auth0|me"
);
assert.equal(
  feedAuthorKey({ id: "w2", appearingAgentId: "agent-star", authorName: "star" }),
  "appear:agent-star"
);
assert.equal(feedAuthorKey({ id: "w3", authorName: "  Mira  " }), "name:mira");
assert.equal(feedAuthorKey({ id: "w4" }), "work:w4");
ok("author keys prefer owner, then appearing agent, then name");

// Three hottest works from one creator would otherwise stack at the top of
// the heat tier. Diversity pulls a different author into the third slot.
assert.deepEqual(
  order([
    work("a1", { publishedAt: hoursAgo(100), recentPlays: 90, authorKey: "user:a" }),
    work("a2", { publishedAt: hoursAgo(110), recentPlays: 80, authorKey: "user:a" }),
    work("a3", { publishedAt: hoursAgo(120), recentPlays: 70, authorKey: "user:a" }),
    work("b1", { publishedAt: hoursAgo(130), recentPlays: 10, authorKey: "user:b" }),
  ]),
  ["a1", "a2", "b1", "a3"]
);
ok(`one creator cannot occupy more than ${MAX_AUTHOR_RUN} neighbouring slots`);

// Diversity must not pull a heat item above an official pick, even when the
// picks are all from one creator and a different author is hotter.
assert.deepEqual(
  order([
    work("hot-other", { publishedAt: hoursAgo(200), recentPlays: 900, authorKey: "user:b" }),
    work("p1", { publishedAt: hoursAgo(300), featuredAt: hoursAgo(3), authorKey: "user:a" }),
    work("p2", { publishedAt: hoursAgo(300), featuredAt: hoursAgo(2), authorKey: "user:a" }),
    work("p3", { publishedAt: hoursAgo(300), featuredAt: hoursAgo(1), authorKey: "user:a" }),
  ]),
  ["p3", "p2", "p1", "hot-other"]
);
ok("official picks stay above heat even when diversity wants another author");

// If every remaining work is the same creator, keep the score order.
assert.deepEqual(
  order([
    work("only-1", { publishedAt: hoursAgo(100), recentPlays: 3, authorKey: "user:a" }),
    work("only-2", { publishedAt: hoursAgo(110), recentPlays: 2, authorKey: "user:a" }),
    work("only-3", { publishedAt: hoursAgo(120), recentPlays: 1, authorKey: "user:a" }),
  ]),
  ["only-1", "only-2", "only-3"]
);
ok("diversity does not invent a different author when there is none");

// Works without an author key must not be treated as the same creator.
assert.deepEqual(
  order([
    work("x", { publishedAt: hoursAgo(100), recentPlays: 3 }),
    work("y", { publishedAt: hoursAgo(110), recentPlays: 2 }),
    work("z", { publishedAt: hoursAgo(120), recentPlays: 1 }),
  ]),
  ["x", "y", "z"]
);
ok("missing author keys do not collapse into one creator");

console.log("\nall feed-ranking checks passed");
