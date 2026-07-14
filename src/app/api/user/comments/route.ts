import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { emitProjectUpdate } from "@/lib/events";
import { unauthorized, badRequest, notFoundJson } from "@/lib/auth";

// 登录用户对成片版本发表时间码批注
export async function POST(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const body = await req.json().catch(() => null);
  const { shareToken, filmVersionId, timecode, content, authorName } = body ?? {};
  if (typeof shareToken !== "string" || !shareToken) return badRequest("`shareToken` is required");
  if (typeof filmVersionId !== "string" || !filmVersionId) return badRequest("`filmVersionId` is required");
  if (typeof content !== "string" || !content.trim()) return badRequest("`content` is required");
  if (content.length > 2000) return badRequest("`content` too long (max 2000)");
  if (timecode != null && (typeof timecode !== "number" || timecode < 0)) {
    return badRequest("`timecode` must be a non-negative number");
  }

  const film = await prisma.filmVersion.findUnique({
    where: { id: filmVersionId },
    select: { id: true, project: { select: { id: true, shareToken: true, isPrivate: true, ownerUserId: true } } },
  });
  if (!film || film.project.shareToken !== shareToken) return notFoundJson();
  // 私密项目仅主人可批注
  if (film.project.isPrivate && film.project.ownerUserId !== sub) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const comment = await prisma.comment.create({
    data: {
      projectId: film.project.id,
      filmVersionId,
      timecode: timecode ?? null,
      content: content.trim(),
      authorSub: sub,
      authorName: typeof authorName === "string" ? authorName.slice(0, 100) : null,
    },
  });
  emitProjectUpdate(film.project.id, "comment.created");
  return Response.json({ comment }, { status: 201 });
}
