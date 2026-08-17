/**
 * End-to-end check of skip / complete recording.
 * Needs a running Studio (BASE_URL) on this database.
 * Run: npx tsx scripts/verify-feed-signals.ts
 */
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { prisma } from "../src/lib/db";
import { PLAYS_PER_NETWORK_PER_HOUR } from "../src/lib/viewerSession";

dotenv.config({ override: true });

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const ok = (label: string) => console.log(`✓ ${label}`);

async function signal(workId: string, kind: "skip" | "complete", cookie?: string) {
  const res = await fetch(`${BASE}/api/feed/signals`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ workId, kind }),
  });
  const body = (await res.json().catch(() => null)) as { counted?: boolean } | null;
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, counted: body?.counted, setCookie };
}

async function main() {
  const work = await prisma.work.create({
    data: { kind: "VIDEO", title: "信号测试", videoUrl: "https://example.com/s.mp4" },
  });

  const first = await signal(work.id, "skip");
  assert.equal(first.status, 202);
  assert.equal(first.counted, true);
  assert.ok(first.setCookie?.includes("cl_viewer="), "a new viewer is issued a key");
  assert.equal(await prisma.workSignal.count({ where: { workId: work.id, kind: "skip" } }), 1);
  ok("a first skip from a new viewer is recorded");

  const viewer = first.setCookie!.split(";")[0];
  const again = await signal(work.id, "skip", viewer);
  assert.equal(again.status, 202);
  assert.equal(again.counted, false);
  assert.equal(await prisma.workSignal.count({ where: { workId: work.id, kind: "skip" } }), 1);
  ok("the same skip in the same hour does not inflate");

  const done = await signal(work.id, "complete", viewer);
  assert.equal(done.counted, true);
  assert.equal(await prisma.workSignal.count({ where: { workId: work.id, kind: "complete" } }), 1);
  ok("a complete is stored separately from a skip");

  assert.equal(await prisma.workPlay.count({ where: { workId: work.id } }), 0);
  ok("signals do not create play rows and so cannot move heat");

  const missing = await signal("no-such-work", "skip");
  assert.equal(missing.status, 404);
  ok("a signal for an unknown work is refused");

  const bad = await fetch(`${BASE}/api/feed/signals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workId: work.id, kind: "play" }),
  });
  assert.equal(bad.status, 400);
  ok("play is not a signal kind");

  const spam = await prisma.work.create({
    data: { kind: "VIDEO", title: "信号测试 · 刷量", videoUrl: "https://example.com/t.mp4" },
  });
  const results: boolean[] = [];
  for (let i = 0; i < PLAYS_PER_NETWORK_PER_HOUR + 3; i += 1) {
    const anon = await signal(spam.id, "skip");
    results.push(anon.counted === true);
  }
  assert.equal(
    results.filter(Boolean).length,
    PLAYS_PER_NETWORK_PER_HOUR,
    `cookieless skips should stop at the cap, got ${JSON.stringify(results)}`
  );
  ok("dropping the cookie cannot inflate skips past the per-network cap");

  const ids = [work.id, spam.id];
  await prisma.workSignal.deleteMany({ where: { workId: { in: ids } } });
  await prisma.work.deleteMany({ where: { id: { in: ids } } });
  console.log("\nall feed-signal checks passed");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
