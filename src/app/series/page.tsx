import Link from "next/link";
import { prisma } from "@/lib/db";
import WorkCard from "@/components/WorkCard";
import { getLocale } from "@/lib/locale";
import { translate, translateCategory } from "@/lib/i18n";
import {
  COLUMN_SERIES_CATEGORY,
  DISCOVER_ALL_CAT,
  DISCOVER_CATEGORIES,
  DISCOVER_COLUMN_CAT,
  storedCategoriesForDiscover,
} from "@/lib/discover";
import { profileHrefsForWorks } from "@/lib/profile";

export const dynamic = "force-dynamic";

function resolveDiscoverCat(cat?: string): string {
  if (!cat || cat === "all" || cat === DISCOVER_ALL_CAT) return DISCOVER_ALL_CAT;
  if (cat === COLUMN_SERIES_CATEGORY) return DISCOVER_COLUMN_CAT;
  if ((DISCOVER_CATEGORIES as readonly string[]).includes(cat)) return cat;
  return DISCOVER_ALL_CAT;
}

export default async function SeriesPage(props: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const locale = await getLocale();
  const { cat } = await props.searchParams;
  const active = resolveDiscoverCat(cat);
  const stored = storedCategoriesForDiscover(active);

  const works = await prisma.work.findMany({
    where: {
      kind: "SERIES",
      ...(stored ? { category: { in: stored } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    include: { _count: { select: { episodes: true } } },
  });
  const authorHrefs = await profileHrefsForWorks(works);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-bold text-zinc-50">{translate(locale, "series.title")}</h1>
      <p className="mt-1 text-sm text-zinc-500">{translate(locale, "series.subtitle")}</p>

      <div className="mt-4 flex gap-2">
        {DISCOVER_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={c === DISCOVER_ALL_CAT ? "/series" : `/series?cat=${encodeURIComponent(c)}`}
            aria-current={c === active ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm transition ${
              c === active
                ? "bg-accent font-medium text-zinc-950"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            }`}
          >
            {translateCategory(locale, c)}
          </Link>
        ))}
      </div>

      {works.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-800 py-20 text-center text-sm text-zinc-500">
          {active === DISCOVER_ALL_CAT
            ? translate(locale, "series.emptyAll")
            : translate(locale, "series.empty", { cat: translateCategory(locale, active) })}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {works.map((w, i) => (
            <WorkCard
              key={w.id}
              work={{
                id: w.id,
                kind: w.kind,
                category: w.category,
                title: w.title,
                coverUrl: w.coverUrl,
                authorName: w.authorName,
                authorHref: authorHrefs[i],
                publishedAt: w.publishedAt.toISOString(),
                episodeCount: w._count.episodes,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
