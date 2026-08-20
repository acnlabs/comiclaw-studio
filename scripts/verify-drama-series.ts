/**
 * Checks 漫剧壳/集: invalid create combos, aired episodes aggregate into one
 * 漫剧 series, order follows dramaOrder, the series stays out of the feed, and
 * it retracts when nothing is aired.
 *
 * Runs against the local database only. Run: npx tsx scripts/verify-drama-series.ts
 */
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";
import { invalidDramaCreate, PROJECT_FORMAT_DRAMA } from "../src/lib/dramaProject";
import { syncDramaToSeries, syncProjectToWork } from "../src/lib/publish";

const ok = (label: string) => console.log(`✓ ${label}`);

assert.equal(
  invalidDramaCreate({ format: "DRAMA", dramaProjectId: "x" }),
  "A drama project cannot belong to another drama",
);
assert.equal(
  invalidDramaCreate({ format: "DRAMA", columnId: "c" }),
  "A drama project cannot attach to a column",
);
assert.equal(
  invalidDramaCreate({ dramaProjectId: "d", parentProjectId: "p" }),
  "A co-creation cannot be a drama episode",
);
assert.equal(invalidDramaCreate({ format: "DRAMA" }), null);
assert.equal(invalidDramaCreate({ dramaProjectId: "d" }), null);
ok("create-time drama rules reject mixed containers");

async function addEpisode(dramaProjectId: string, order: number, name: string) {
  return prisma.project.create({
    data: {
      name,
      visibility: "PRIVATE",
      format: "VIDEO",
      dramaProjectId,
      dramaOrder: order,
    },
  });
}

async function air(projectId: string, videoUrl: string) {
  await prisma.filmVersion.create({
    data: { projectId, version: 1, videoUrl, duration: 15, authorKey: "agent:test" },
  });
  await syncProjectToWork(projectId);
}

async function seriesOf(dramaProjectId: string) {
  return prisma.work.findUnique({
    where: { dramaProjectId },
    include: { episodes: { orderBy: { order: "asc" } } },
  });
}

async function episodes(dramaProjectId: string) {
  const work = await seriesOf(dramaProjectId);
  return work?.episodes.map((e) => ({ order: e.order, title: e.title, videoUrl: e.videoUrl })) ?? [];
}

async function main() {
  const stamp = Date.now();
  const shell = await prisma.project.create({
    data: {
      name: `漫剧验证 ${stamp}`,
      description: "剧情连续",
      visibility: "PRIVATE",
      format: PROJECT_FORMAT_DRAMA,
    },
  });

  const e1 = await addEpisode(shell.id, 1, "第 1 集");
  const e2 = await addEpisode(shell.id, 2, "第 2 集");

  await syncDramaToSeries(shell.id);
  assert.equal(await prisma.work.count({ where: { dramaProjectId: shell.id } }), 0);
  ok("a drama with no aired episode gets no series");

  assert.equal(await syncProjectToWork(shell.id), null);
  assert.equal(await prisma.work.count({ where: { projectId: shell.id } }), 0);
  ok("syncing a drama shell never creates a video work");

  await air(e1.id, "https://example.com/drama-1.mp4");
  const first = await syncDramaToSeries(shell.id);
  assert.ok(first);
  assert.equal(first.kind, "SERIES");
  assert.equal(first.category, "漫剧");
  assert.equal(first.title, shell.name);
  assert.equal(first.videoUrl, null);
  assert.equal(first.dramaProjectId, shell.id);
  assert.equal(first.projectId, null);
  assert.deepEqual(await episodes(shell.id), [
    { order: 1, title: "第 1 集", videoUrl: "https://example.com/drama-1.mp4" },
  ]);
  const video1 = await prisma.work.findUniqueOrThrow({ where: { projectId: e1.id } });
  const firstEps = await prisma.episode.findMany({
    where: { workId: first.id },
    orderBy: { order: "asc" },
  });
  assert.equal(firstEps[0]?.sourceWorkId, video1.id);
  ok("the first aired episode creates the 漫剧 series");

  assert.equal(await syncProjectToWork(shell.id), null);
  const seriesAfterShellSync = await seriesOf(shell.id);
  assert.equal(seriesAfterShellSync?.id, first.id);
  assert.equal(seriesAfterShellSync?.kind, "SERIES");
  assert.equal(seriesAfterShellSync?.projectId, null);
  ok("syncing a drama shell later does not overwrite the series");

  await air(e2.id, "https://example.com/drama-2.mp4");
  await syncDramaToSeries(shell.id);
  assert.deepEqual(await episodes(shell.id), [
    { order: 1, title: "第 1 集", videoUrl: "https://example.com/drama-1.mp4" },
    { order: 2, title: "第 2 集", videoUrl: "https://example.com/drama-2.mp4" },
  ]);
  ok("a later episode appends in drama order");

  const before = await prisma.work.findUniqueOrThrow({ where: { dramaProjectId: shell.id } });
  await syncDramaToSeries(shell.id);
  await syncDramaToSeries(shell.id);
  const after = await prisma.work.findUniqueOrThrow({ where: { dramaProjectId: shell.id } });
  assert.equal(after.id, before.id);
  assert.equal((await episodes(shell.id)).length, 2);
  ok("repeated syncs are idempotent");

  const feed = await prisma.work.findMany({
    where: { kind: "VIDEO", project: { dramaProjectId: shell.id } },
  });
  assert.equal(feed.length, 2, "every aired episode is its own feed work");
  const inFeed = await prisma.work.count({
    where: { kind: "VIDEO", id: after.id },
  });
  assert.equal(inFeed, 0, "the series aggregate is excluded from the feed");
  ok("each episode enters the feed once; the series does not");

  await prisma.filmVersion.deleteMany({ where: { projectId: { in: [e1.id, e2.id] } } });
  await syncDramaToSeries(shell.id);
  assert.equal(await prisma.work.count({ where: { dramaProjectId: shell.id, kind: "SERIES" } }), 0);
  ok("the series is retracted once nothing is aired");

  await prisma.work.deleteMany({
    where: { OR: [{ dramaProjectId: shell.id }, { project: { dramaProjectId: shell.id } }] },
  });
  await prisma.project.deleteMany({ where: { dramaProjectId: shell.id } });
  await prisma.project.delete({ where: { id: shell.id } });
  console.log("\nall drama-series checks passed");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
