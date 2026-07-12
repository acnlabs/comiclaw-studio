import { prisma } from "@/lib/db";
import WorkCard from "@/components/WorkCard";

export const dynamic = "force-dynamic";

// 推荐:平台作品流,展示用 comiclaw 创作的短视频与短剧
export default async function RecommendPage() {
  const works = await prisma.work.findMany({
    orderBy: { publishedAt: "desc" },
    include: { _count: { select: { episodes: true } } },
  });

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-bold text-zinc-50">推荐</h1>
      <p className="mt-1 text-sm text-zinc-500">用 comiclaw 创作的短视频与短剧</p>

      {works.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-800 py-20 text-center text-sm text-zinc-500">
          还没有发布的作品。项目发行上架后会自动同步到这里。
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {works.map((w) => (
            <WorkCard
              key={w.id}
              work={{ ...w, episodeCount: w._count.episodes }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
