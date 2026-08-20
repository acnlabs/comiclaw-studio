/**
 * Checks the 专栏 workspace list: official 记 only (no co-creations),
 * order follows entryOrder, and a later 记 appends after the first.
 *
 * Runs against the local database only. Run: npx tsx scripts/verify-column-workspace.ts
 */
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";

const ok = (label: string) => console.log(`✓ ${label}`);

async function officialEntries(columnId: string) {
  return prisma.project.findMany({
    where: { columnId, parentProjectId: null },
    orderBy: [{ entryOrder: "asc" }, { createdAt: "asc" }],
    select: { name: true, entryOrder: true, visibility: true, parentProjectId: true },
  });
}

async function main() {
  const stamp = Date.now();
  const column = await prisma.column.create({
    data: {
      slug: `workspace-${stamp}`,
      name: `专栏工作台 ${stamp}`,
      description: "主题不必连续",
      ownerUserId: "user:test",
    },
  });

  const e1 = await prisma.project.create({
    data: {
      name: "第 1 集",
      visibility: "PUBLIC",
      columnId: column.id,
      entryOrder: 1,
      ownerKind: "user",
      ownerUserId: "user:test",
    },
  });
  const derived = await prisma.project.create({
    data: {
      name: "二创",
      visibility: "PUBLIC",
      columnId: column.id,
      parentProjectId: e1.id,
      ownerKind: "user",
      ownerUserId: "user:test",
    },
  });
  await prisma.project.create({
    data: {
      name: "第 2 集",
      visibility: "PUBLIC",
      columnId: column.id,
      entryOrder: 2,
      ownerKind: "user",
      ownerUserId: "user:test",
    },
  });

  const listed = await officialEntries(column.id);
  assert.deepEqual(
    listed.map((e) => ({ name: e.name, entryOrder: e.entryOrder })),
    [
      { name: "第 1 集", entryOrder: 1 },
      { name: "第 2 集", entryOrder: 2 },
    ],
  );
  assert.ok(listed.every((e) => e.visibility === "PUBLIC" && e.parentProjectId == null));
  ok("workspace lists official 记 in entry order and skips co-creations");

  const myProjects = await prisma.project.findMany({
    where: {
      ownerUserId: "user:test",
      dramaProjectId: null,
      NOT: { AND: [{ columnId: { not: null } }, { parentProjectId: null }] },
    },
  });
  assert.equal(myProjects.some((p) => p.id === e1.id), false);
  assert.equal(myProjects.some((p) => p.id === derived.id), true);
  ok("official 记 stay off the top-level project list");

  await prisma.project.delete({ where: { id: derived.id } });
  await prisma.project.deleteMany({ where: { columnId: column.id } });
  await prisma.column.delete({ where: { id: column.id } });
  console.log("\nall column-workspace checks passed");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
