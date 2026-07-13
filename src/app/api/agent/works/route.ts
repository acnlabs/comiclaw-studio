import { prisma } from "@/lib/db";
import { withAgentAuth, parseBody } from "@/lib/api";
import { publishWorkSchema } from "@/lib/schemas";

// 直接发布平台作品(不经 studio 项目流程,如整部短剧)
export const POST = withAgentAuth(async (req) => {
  const body = await parseBody(req, publishWorkSchema);
  const episodes = body.episodes ?? [];

  const work = await prisma.work.create({
    data: {
      kind: body.kind,
      category: body.category ?? (body.kind === "SERIES" ? "漫剧" : null),
      title: body.title,
      description: body.description ?? null,
      coverUrl: body.coverUrl ?? null,
      videoUrl: body.videoUrl ?? null,
      authorName: body.authorName ?? null,
      episodes: {
        create: episodes.map((e) => ({
          order: e.order,
          title: e.title ?? null,
          videoUrl: e.videoUrl,
          duration: e.duration ?? null,
        })),
      },
    },
    include: { episodes: true },
  });
  return Response.json({ work }, { status: 201 });
});
