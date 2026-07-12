import { prisma } from "@/lib/db";
import { checkApiKey, unauthorized, badRequest } from "@/lib/auth";

const VALID_KINDS = ["VIDEO", "SERIES"];

// 直接发布平台作品(不经 studio 项目流程,如整部短剧)
export async function POST(req: Request) {
  if (!checkApiKey(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  if (!body?.title) return badRequest("`title` is required");
  if (!VALID_KINDS.includes(body.kind)) {
    return badRequest(`kind must be one of ${VALID_KINDS.join(", ")}`);
  }
  if (body.kind === "VIDEO" && !body.videoUrl) {
    return badRequest("`videoUrl` is required for kind VIDEO");
  }

  const episodes: { order: number; title?: string; videoUrl: string; duration?: number }[] =
    Array.isArray(body.episodes) ? body.episodes : [];
  if (body.kind === "SERIES" && episodes.length === 0) {
    return badRequest("`episodes` is required for kind SERIES");
  }

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
}
