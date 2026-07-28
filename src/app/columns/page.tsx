import Link from "next/link";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";
import { fmtDate } from "@/lib/format";
import { safeMediaUrl } from "@/lib/columnTimeline";

export const dynamic = "force-dynamic";

const PINNED_SLUG = "ai-journal";

export default async function ColumnsIndexPage() {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
    translate(locale, key, params);

  const columns = await prisma.column.findMany({
    where: {
      projects: { some: { visibility: "PUBLIC" } },
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
      _count: {
        select: { projects: { where: { visibility: "PUBLIC" } } },
      },
    },
  });

  columns.sort((a, b) => {
    if (a.slug === PINNED_SLUG && b.slug !== PINNED_SLUG) return -1;
    if (b.slug === PINNED_SLUG && a.slug !== PINNED_SLUG) return 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <p className="text-[11px] tracking-[0.22em] text-accent/90 uppercase">
        {t("columnsIndex.eyebrow")}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-50">
        {t("columnsIndex.title")}
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
        {t("columnsIndex.subtitle")}
      </p>

      {columns.length === 0 ? (
        <div className="mt-12 border border-dashed border-zinc-800 py-20 text-center text-sm text-zinc-500">
          {t("columnsIndex.empty")}
        </div>
      ) : (
        <ul className="mt-10 space-y-3">
          {columns.map((c) => {
            const cover = safeMediaUrl(c.coverUrl);
            const pinned = c.slug === PINNED_SLUG;
            return (
              <li key={c.id}>
                <Link
                  href={`/columns/${c.slug}`}
                  className="flex items-stretch gap-4 border border-zinc-800 bg-zinc-900/40 transition-colors hover:border-zinc-600"
                >
                  <div className="relative h-28 w-28 shrink-0 bg-zinc-950 sm:h-32 sm:w-36">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt=""
                        className="h-full w-full object-cover opacity-80"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] tracking-widest text-zinc-600 uppercase">
                        {t("columnsIndex.noCover")}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 py-4 pr-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-zinc-50">
                        {c.name}
                      </h2>
                      {pinned ? (
                        <span className="text-[10px] tracking-wide text-accent uppercase">
                          {t("columnsIndex.official")}
                        </span>
                      ) : null}
                    </div>
                    {c.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
                        {c.description}
                      </p>
                    ) : null}
                    <p className="mt-3 text-xs text-zinc-600">
                      {t("columnsIndex.meta", {
                        n: c._count.projects,
                        date: fmtDate(c.updatedAt.toISOString(), locale),
                      })}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
