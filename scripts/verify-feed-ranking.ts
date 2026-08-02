/**
 * Offline checks for the For You ordering.
 * Run: npx tsx scripts/verify-feed-ranking.ts
 */
import assert from "node:assert/strict";
import {
  rankForYou,
  feedTier,
  FEATURED_WINDOW_HOURS,
  FRESH_WINDOW_HOURS,
} from "../src/lib/feedRanking";

const ok = (label: string) => console.log(`✓ ${label}`);

const NOW = Date.parse("2026-08-02T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

const work = (
  id: string,
  o: { featuredAt?: string | null; publishedAt: string; recentPlays?: number }
) => ({ id, featuredAt: o.featuredAt ?? null, publishedAt: o.publishedAt, recentPlays: o.recentPlays ?? 0 });

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

console.log("\nall feed-ranking checks passed");
