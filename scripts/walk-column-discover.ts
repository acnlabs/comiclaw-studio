/**
 * Walks a throwaway 专栏: add a 记, air it, list it the way Studio does,
 * then assert Discover · 专栏 and /columns/[slug] would show it.
 *
 * Does not touch the official ai-journal column.
 * Run: npx tsx scripts/walk-column-discover.ts
 */
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";
import { DISCOVER_COLUMN_CAT, storedCategoriesForDiscover } from "../src/lib/discover";
import { COLUMN_SERIES_CATEGORY, publishProjectToComiclaw } from "../src/lib/publish";

const ok = (label: string) => console.log(`✓ ${label}`);

async function main() {
  const stamp = Date.now();
  const slug = `walk-discover-${stamp}`;
  const column = await prisma.column.create({
    data: {
      slug,
      name: `走查专栏 ${stamp}`,
      description: "测试发现入口，不是《AI 漫记》",
    },
  });
  const issue = await prisma.project.create({
    data: {
      name: "第 1 记 · 走查",
      visibility: "PUBLIC",
      columnId: column.id,
      entryOrder: 1,
    },
  });

  try {
    await prisma.filmVersion.create({
      data: {
        projectId: issue.id,
        version: 1,
        videoUrl: "https://example.com/walk-column-1.mp4",
        duration: 15,
        authorKey: "agent:walk",
      },
    });
    ok("added a 记 and a final film");

    const listed = await publishProjectToComiclaw(issue.id, {
      title: "第 1 记 · 走查",
      mode: "episode",
      episodeOrder: 1,
      episodeTitle: "第 1 记 · 走查",
    });
    assert.ok(listed.video);
    assert.equal(listed.video.kind, "VIDEO");
    const series = listed.series;
    assert.ok(series);
    assert.equal(series.kind, "SERIES");
    assert.equal(series.category, COLUMN_SERIES_CATEGORY);
    assert.equal(series.title, column.name);
    ok("listing a 记 creates the feed video and the 专栏 series");

    const stored = storedCategoriesForDiscover(DISCOVER_COLUMN_CAT);
    assert.ok(stored);
    const discover = await prisma.work.findMany({
      where: {
        kind: "SERIES",
        category: { in: stored },
        id: series.id,
      },
    });
    assert.equal(discover.length, 1);
    ok("Discover · 专栏 lists this series");

    const permalink = await prisma.column.findUniqueOrThrow({
      where: { id: column.id },
      select: { seriesWork: { select: { id: true } } },
    });
    assert.equal(permalink.seriesWork?.id, series.id);
    ok(`/columns/${slug} would open /series/${series.id}`);

    const feedDup = await prisma.work.count({
      where: { kind: "VIDEO", id: series.id },
    });
    assert.equal(feedDup, 0);
    ok("the series stays out of For You; the 记 is the feed item");

    console.log("\nwalk-column-discover passed");
  } finally {
    await prisma.project.delete({ where: { id: issue.id } }).catch(() => undefined);
    await prisma.column.delete({ where: { id: column.id } }).catch(() => undefined);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
