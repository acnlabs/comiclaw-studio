import { prisma } from "@/lib/db";
import WorkCard from "@/components/WorkCard";

export const dynamic = "force-dynamic";

// 短剧库:子类目前仅「漫剧」
const CATEGORIES = ["漫剧"];

export default async function SeriesPage(props: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat } = await props.searchParams;
  const active = CATEGORIES.includes(cat ?? "") ? (cat as string) : CATEGORIES[0];

  const works = await prisma.work.findMany({
    where: { kind: "SERIES", category: active },
    orderBy: { publishedAt: "desc" },
    include: { _count: { select: { episodes: true } } },
  });

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-bold text-zinc-50">短剧</h1>
      <p className="mt-1 text-sm text-zinc-500">用 comiclaw 创作的短剧,数字人可参演或主演</p>

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
            {c}
          </span>
        ))}
      </div>

      {works.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-800 py-20 text-center text-sm text-zinc-500">
          「{active}」分类下还没有作品
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {works.map((w) => (
            <WorkCard key={w.id} work={{ ...w, episodeCount: w._count.episodes }} />
          ))}
        </div>
      )}
    </div>
  );
}
