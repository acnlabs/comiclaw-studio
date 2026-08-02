import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";
import ColumnCard from "@/components/column/ColumnCard";

export const dynamic = "force-dynamic";

const PINNED_SLUG = "ai-journal";

export default async function ColumnsIndexPage() {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
    translate(locale, key, params);

  // 记数只算纵向的记;一记下面的共创不该把「共 N 记」撑大
  const publicEntry = { visibility: "PUBLIC", parentProjectId: null } as const;

  const columns = await prisma.column.findMany({
    where: {
      projects: { some: publicEntry },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      coverUrl: true,
      updatedAt: true,
      projects: {
        where: publicEntry,
        orderBy: [
          { entryOrder: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
        ],
        take: 1,
        select: { name: true },
      },
      _count: {
        select: { projects: { where: publicEntry } },
      },
    },
  });

  columns.sort((a, b) => {
    if (a.slug === PINNED_SLUG && b.slug !== PINNED_SLUG) return -1;
    if (b.slug === PINNED_SLUG && a.slug !== PINNED_SLUG) return 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-bold text-zinc-50">{t("columnsIndex.title")}</h1>
      <p className="mt-1 text-sm text-zinc-500">{t("columnsIndex.subtitle")}</p>

      {columns.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-800 py-20 text-center text-sm text-zinc-500">
          {t("columnsIndex.empty")}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {columns.map((c) => (
            <ColumnCard
              key={c.id}
              column={{
                slug: c.slug,
                name: c.name,
                description: c.description,
                coverUrl: c.coverUrl,
                entryCount: c._count.projects,
                latestEntry: c.projects[0]?.name ?? null,
              }}
              officialLabel={
                c.slug === PINNED_SLUG ? t("columnsIndex.official") : null
              }
              entriesLabel={t(
                c._count.projects === 1
                  ? "columnsIndex.entryOne"
                  : "columnsIndex.entries",
                { n: c._count.projects }
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
