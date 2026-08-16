/**
 * Rebuild Discover → Columns series works from aired official 记.
 * Safe to rerun. Needs DATABASE_URL.
 *
 *   DATABASE_URL=… npx tsx scripts/sync-column-series.ts
 */
import { prisma } from "../src/lib/db";
import { syncColumnToSeries } from "../src/lib/publish";

async function main() {
  const columns = await prisma.column.findMany({ select: { id: true, slug: true, name: true } });
  let synced = 0;
  let empty = 0;
  for (const column of columns) {
    const work = await syncColumnToSeries(column.id);
    if (work) {
      synced += 1;
      console.log(`✓ ${column.slug} → ${work.title} (${work.id})`);
    } else {
      empty += 1;
      console.log(`· ${column.slug} — no aired entries, no series`);
    }
  }
  console.log(`done: ${synced} series, ${empty} skipped`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
