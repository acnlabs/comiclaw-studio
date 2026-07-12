import { prisma } from "@/lib/db";
import WorkCard from "@/components/WorkCard";
import { getLocale } from "@/lib/locale";
import { translate, translateCategory } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// 短剧库:子类目前仅「漫剧」(分类值以中文存储,展示时按语言映射)
const CATEGORIES = ["漫剧"];

export default async function SeriesPage(props: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const locale = await getLocale();
  const { cat } = await props.searchParams;
  const active = CATEGORIES.includes(cat ?? "") ? (cat as string) : CATEGORIES[0];

  const works = await prisma.work.findMany({
    where: { kind: "SERIES", category: active },
    orderBy: { publishedAt: "desc" },
    include: { _count: { select: { episodes: true } } },
  });

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-bold text-zinc-50">{translate(locale, "series.title")}</h1>
      <p className="mt-1 text-sm text-zinc-500">{translate(locale, "series.subtitle")}</p>

      <div className="mt-4 flex gap-2">
        {CATEGORIES.map((c) => (
          <span
            key={c}
            className={`rounded-full px-3.5 py-1.5 text-sm ${
              c === active
                ? "bg-accent font-medium text-zinc-950"
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {translateCategory(locale, c)}
          </span>
        ))}
      </div>

      {works.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-800 py-20 text-center text-sm text-zinc-500">
          {translate(locale, "series.empty", { cat: translateCategory(locale, active) })}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {works.map((w) => (
            <WorkCard
              key={w.id}
              work={{
                id: w.id,
                kind: w.kind,
                category: w.category,
                title: w.title,
                coverUrl: w.coverUrl,
                authorName: w.authorName,
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
