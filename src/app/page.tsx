import { prisma } from "@/lib/db";
import VideoFeed, { type FeedItem } from "@/components/VideoFeed";
import { HEAT_WINDOW_HOURS, feedAuthorKey, feedTier, rankForYou } from "@/lib/feedRanking";
import { profileHrefsForWorks } from "@/lib/profile";

export const dynamic = "force-dynamic";

// 排序见 feedRanking——官方推荐、新发布、真实热度,再按作者去重。
// 取「现在」是不纯的,所以整段放在渲染之外
async function loadFeedItems(): Promise<FeedItem[]> {
  const works = await prisma.work.findMany({
    // 专栏系列是各记的聚合视图,各记本身已在流中;放它进来只会重复同一支视频
    where: { columnId: null },
    include: {
      episodes: { orderBy: { order: "asc" }, take: 1 },
      _count: { select: { episodes: true } },
    },
  });
  if (works.length === 0) return [];

  const now = Date.now();
  const heat = await prisma.workPlay.groupBy({
    by: ["workId"],
    where: {
      workId: { in: works.map((w) => w.id) },
      createdAt: { gte: new Date(now - HEAT_WINDOW_HOURS * 3600_000) },
    },
    _count: { _all: true },
  });
  const playsByWork = new Map(heat.map((h) => [h.workId, h._count._all]));

  const ranked = rankForYou(
    works.map((w) => ({
      work: w,
      featuredAt: w.featuredAt,
      publishedAt: w.publishedAt,
      recentPlays: playsByWork.get(w.id) ?? 0,
      authorKey: feedAuthorKey(w),
    })),
    now
  );

  const hrefs = await profileHrefsForWorks(ranked.map(({ work }) => work));

  // 短剧取第一集作为信息流内容;无可播放内容的作品不进入信息流
  return ranked
    .map(({ work: w, ...rankable }, i) => ({
      id: w.id,
      kind: w.kind,
      category: w.category,
      title: w.title,
      description: w.description,
      authorName: w.authorName,
      authorHref: hrefs[i],
      playUrl: w.videoUrl ?? w.episodes[0]?.videoUrl ?? "",
      coverUrl: w.coverUrl,
      episodeCount: w._count.episodes,
      videoId: w.episodes[0]?.sourceWorkId ?? w.episodes[0]?.id ?? w.id,
      episodeId: w.episodes[0]?.id ?? null,
      // 与排序同一个窗口判断,过期的推荐不再挂标
      featured: feedTier(rankable, now) === 0,
    }))
    .filter((w) => w.playUrl);
}

// 推荐:TikTok 式滑动观看的作品流
export default async function RecommendPage() {
  const items = await loadFeedItems();
  return <VideoFeed items={items} />;
}
