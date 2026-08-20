/**
 * Checks how a column's entries aggregate into one series work: only aired
 * entries count, order follows the entry order, rebuilds are idempotent, the
 * series retracts when nothing is aired, and it stays out of the feed so a
 * hook video is not counted twice.
 *
 * Runs against the local database only. Run: npx tsx scripts/verify-column-series.ts
 */
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";
import { syncColumnToSeries, syncProjectToWork, COLUMN_SERIES_CATEGORY } from "../src/lib/publish";
import { DISCOVER_COLUMN_CAT, storedCategoriesForDiscover } from "../src/lib/discover";

const ok = (label: string) => console.log(`✓ ${label}`);

async function addEntry(columnId: string, order: number, name: string) {
  return prisma.project.create({
    data: { name, visibility: "PUBLIC", columnId, entryOrder: order, agentName: "comiclaw" },
  });
}

async function air(projectId: string, videoUrl: string) {
  await prisma.filmVersion.create({
    data: { projectId, version: 1, videoUrl, duration: 15, authorKey: "agent:test" },
  });
  await syncProjectToWork(projectId);
}

async function episodes(columnId: string) {
  const work = await prisma.work.findUnique({
    where: { columnId },
    include: { episodes: { orderBy: { order: "asc" } } },
  });
  return work?.episodes.map((e) => ({ order: e.order, title: e.title, videoUrl: e.videoUrl })) ?? [];
}

async function main() {
  const column = await prisma.column.create({
    data: { slug: `series-sync-${Date.now()}`, name: "AI 漫记", description: "每日钩子" },
  });

  const e1 = await addEntry(column.id, 1, "第 1 记");
  const e2 = await addEntry(column.id, 2, "第 2 记");

  // A column whose entries are all script-only must not squat in the series library.
  await syncColumnToSeries(column.id);
  assert.equal(await prisma.work.count({ where: { columnId: column.id } }), 0);
  ok("a column with no aired entry gets no series");

  // One hook aired: the series appears, carrying that hook as its first episode.
  await air(e1.id, "https://example.com/hook-1.mp4");
  const first = await syncColumnToSeries(column.id);
  assert.ok(first);
  assert.equal(first.kind, "SERIES");
  assert.equal(first.category, COLUMN_SERIES_CATEGORY);
  assert.equal(first.title, "AI 漫记");
  assert.equal(first.videoUrl, null, "a series is played through its episodes");
  assert.deepEqual(await episodes(column.id), [
    { order: 1, title: "第 1 记", videoUrl: "https://example.com/hook-1.mp4" },
  ]);
  const video1 = await prisma.work.findUniqueOrThrow({ where: { projectId: e1.id } });
  const firstEps = await prisma.episode.findMany({
    where: { workId: first.id },
    orderBy: { order: "asc" },
  });
  assert.equal(firstEps[0]?.sourceWorkId, video1.id, "episode comments follow the feed work");
  const stored = storedCategoriesForDiscover(DISCOVER_COLUMN_CAT);
  assert.ok(stored);
  assert.equal(
    await prisma.work.count({
      where: { kind: "SERIES", category: { in: stored }, id: first.id },
    }),
    1,
  );
  const permalink = await prisma.column.findUniqueOrThrow({
    where: { id: column.id },
    select: { seriesWork: { select: { id: true } } },
  });
  assert.equal(permalink.seriesWork?.id, first.id);
  ok("Discover · 专栏 lists the series; /columns/slug opens the player");
  ok("the first aired hook creates the series and becomes episode 1");

  // The next entry appends rather than replacing, and keeps entry order.
  await air(e2.id, "https://example.com/hook-2.mp4");
  await syncColumnToSeries(column.id);
  assert.deepEqual(await episodes(column.id), [
    { order: 1, title: "第 1 记", videoUrl: "https://example.com/hook-1.mp4" },
    { order: 2, title: "第 2 记", videoUrl: "https://example.com/hook-2.mp4" },
  ]);
  const video2 = await prisma.work.findUniqueOrThrow({ where: { projectId: e2.id } });
  const secondEps = await prisma.episode.findMany({
    where: { workId: first.id },
    orderBy: { order: "asc" },
  });
  assert.deepEqual(
    secondEps.map((e) => e.sourceWorkId),
    [video1.id, video2.id],
    "each episode points at its own feed work",
  );
  ok("a later hook appends as the next episode, in entry order");

  // The daily loop calls this on every release, so repeats must not pile up.
  const before = await prisma.work.findUniqueOrThrow({ where: { columnId: column.id } });
  await syncColumnToSeries(column.id);
  await syncColumnToSeries(column.id);
  const after = await prisma.work.findUniqueOrThrow({ where: { columnId: column.id } });
  assert.equal(after.id, before.id, "the series work is reused, not duplicated");
  assert.equal((await episodes(column.id)).length, 2, "episodes are rebuilt, not appended twice");
  ok("repeated syncs are idempotent");

  // An entry aired out of order still lands in its numbered slot.
  const e0 = await addEntry(column.id, 0, "第 0 记");
  await air(e0.id, "https://example.com/hook-0.mp4");
  await syncColumnToSeries(column.id);
  assert.deepEqual(
    (await episodes(column.id)).map((e) => e.title),
    ["第 0 记", "第 1 记", "第 2 记"]
  );
  ok("episode order follows entry order, not airing order");

  // Each hook is its own feed work; the series must not add a duplicate.
  const feed = await prisma.work.findMany({
    where: { columnId: null, project: { columnId: column.id } },
  });
  assert.equal(feed.length, 3, "every aired hook is its own feed work");
  const inFeed = await prisma.work.count({
    where: { columnId: null, id: after.id },
  });
  assert.equal(inFeed, 0, "the series aggregate is excluded from the feed");
  ok("each hook enters the feed once; the series aggregate does not");

  // Pulling the films retracts the series instead of leaving an empty shell.
  await prisma.filmVersion.deleteMany({ where: { projectId: { in: [e0.id, e1.id, e2.id] } } });
  await syncColumnToSeries(column.id);
  assert.equal(await prisma.work.count({ where: { columnId: column.id } }), 0);
  ok("the series is retracted once nothing is aired");

  await prisma.work.deleteMany({ where: { project: { columnId: column.id } } });
  await prisma.project.deleteMany({ where: { columnId: column.id } });
  await prisma.column.delete({ where: { id: column.id } });
  console.log("\nall column-series checks passed");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
