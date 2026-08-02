/**
 * End-to-end check of play recording and how it moves the For You feed:
 * a play is counted once per viewer per hour, a different viewer counts
 * separately, and an official pick reaches the top through the ops endpoint.
 *
 * Needs a running Studio (BASE_URL) on this database.
 * Run: npx tsx scripts/verify-feed-plays.ts
 */
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { prisma } from "../src/lib/db";
import { rankForYou, HEAT_WINDOW_HOURS } from "../src/lib/feedRanking";

dotenv.config({ override: true });

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const ok = (label: string) => console.log(`✓ ${label}`);

async function play(workId: string, cookie?: string) {
  const res = await fetch(`${BASE}/api/feed/plays`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ workId }),
  });
  const body = (await res.json().catch(() => null)) as { counted?: boolean } | null;
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, counted: body?.counted, setCookie };
}

/** Plays inside the heat window, the way the feed counts them */
async function heat(workId: string) {
  return prisma.workPlay.count({
    where: {
      workId,
      createdAt: { gte: new Date(Date.now() - HEAT_WINDOW_HOURS * 3600_000) },
    },
  });
}

async function main() {
  const hot = await prisma.work.create({
    data: { kind: "VIDEO", title: "热度测试 · 被看的", videoUrl: "https://example.com/a.mp4" },
  });
  const quiet = await prisma.work.create({
    data: { kind: "VIDEO", title: "热度测试 · 没人看的", videoUrl: "https://example.com/b.mp4" },
  });

  // An unknown viewer gets a key back, and the play counts.
  const first = await play(hot.id);
  assert.equal(first.status, 202);
  assert.equal(first.counted, true);
  assert.ok(first.setCookie?.includes("cl_viewer="), "a new viewer is issued a key");
  assert.ok(first.setCookie?.includes("HttpOnly"), "the viewer key is not readable by scripts");
  assert.equal(await heat(hot.id), 1);
  ok("a first play from a new viewer is recorded, and the viewer gets a key");

  // Looping the same video, or scrolling back to it, must not inflate heat.
  const viewer = first.setCookie!.split(";")[0];
  for (let i = 0; i < 5; i += 1) {
    const again = await play(hot.id, viewer);
    assert.equal(again.status, 202);
    assert.equal(again.counted, false, "a repeat within the hour must not count");
  }
  assert.equal(await heat(hot.id), 1, "five more plays from the same viewer stay at one");
  ok("replays from the same viewer within the hour do not inflate heat");

  // A different viewer is a different play.
  const second = await play(hot.id, "cl_viewer=someoneelsesviewerkey00001");
  assert.equal(second.counted, true);
  assert.equal(await heat(hot.id), 2);
  ok("a different viewer counts separately");

  // A junk cookie must not be trusted as a key; it is replaced.
  const junk = await play(quiet.id, "cl_viewer=not a valid key!!");
  assert.equal(junk.counted, true);
  assert.ok(junk.setCookie?.includes("cl_viewer="), "an invalid key is replaced, not used");
  ok("a malformed viewer cookie is rejected and reissued");

  const missing = await play("no-such-work");
  assert.equal(missing.status, 404);
  ok("a play for an unknown work is refused");

  // Heat decides the order once neither work is fresh any more.
  const aged = new Date(Date.now() - 72 * 3600_000);
  await prisma.work.updateMany({
    where: { id: { in: [hot.id, quiet.id] } },
    data: { publishedAt: aged },
  });
  const rows = await prisma.work.findMany({
    where: { id: { in: [hot.id, quiet.id] } },
    select: { id: true, title: true, featuredAt: true, publishedAt: true },
  });
  const withHeat = await Promise.all(
    rows.map(async (w) => ({ ...w, recentPlays: await heat(w.id) }))
  );
  assert.deepEqual(
    rankForYou(withHeat).map((w) => w.id),
    [hot.id, quiet.id],
    "the watched work should lead the unwatched one"
  );
  ok("among works past their fresh window, the watched one leads");

  // Ops can lift the quiet one above the watched one.
  const key = process.env.ADMIN_KEY?.trim();
  assert.ok(key, "ADMIN_KEY must be set to exercise the ops endpoint");
  const feature = await fetch(`${BASE}/api/admin/works/${quiet.id}/feature`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `studio_admin=${key}`,
      origin: BASE,
    },
    body: JSON.stringify({ featured: true }),
  });
  assert.equal(feature.status, 200, `feature: ${await feature.text()}`);

  const refreshed = await prisma.work.findMany({
    where: { id: { in: [hot.id, quiet.id] } },
    select: { id: true, featuredAt: true, publishedAt: true },
  });
  const reranked = await Promise.all(
    refreshed.map(async (w) => ({ ...w, recentPlays: await heat(w.id) }))
  );
  assert.deepEqual(
    rankForYou(reranked).map((w) => w.id),
    [quiet.id, hot.id],
    "an official pick should lead even with no plays"
  );
  ok("an official pick set through the ops endpoint takes the top");

  const unauth = await fetch(`${BASE}/api/admin/works/${quiet.id}/feature`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ featured: true }),
  });
  assert.equal(unauth.status, 401, "featuring must need the ops key");
  ok("featuring without the ops key is refused");

  await prisma.workPlay.deleteMany({ where: { workId: { in: [hot.id, quiet.id] } } });
  await prisma.work.deleteMany({ where: { id: { in: [hot.id, quiet.id] } } });
  console.log("\nall feed-play checks passed");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
