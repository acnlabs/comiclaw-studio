import { prisma } from "@/lib/db";
import VideoFeed, { type FeedItem } from "@/components/VideoFeed";

export const dynamic = "force-dynamic";

// 推荐:TikTok 式滑动观看的作品流
export default async function RecommendPage() {
  const works = await prisma.work.findMany({
    orderBy: { publishedAt: "desc" },
    include: {
      episodes: { orderBy: { order: "asc" }, take: 1 },
      _count: { select: { episodes: true } },
    },
  });

  // 短剧取第一集作为信息流内容;无可播放内容的作品不进入信息流
  const items: FeedItem[] = works
    .map((w) => ({
      id: w.id,
      kind: w.kind,
      category: w.category,
      title: w.title,
      description: w.description,
      authorName: w.authorName,
      playUrl: w.videoUrl ?? w.episodes[0]?.videoUrl ?? "",
      coverUrl: w.coverUrl,
      episodeCount: w._count.episodes,
    }))
    .filter((w) => w.playUrl);

  return <VideoFeed items={items} />;
}
