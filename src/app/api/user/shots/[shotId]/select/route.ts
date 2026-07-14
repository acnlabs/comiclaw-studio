import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { emitProjectUpdate } from "@/lib/events";
import { unauthorized, badRequest, notFoundJson } from "@/lib/auth";

type Ctx = { params: Promise<{ shotId: string }> };

// 客户选定分镜的候选版本(抽卡选片)
export async function POST(req: Request, ctx: Ctx) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const body = await req.json().catch(() => null);
  const { shareToken, version } = body ?? {};
  if (typeof shareToken !== "string" || !shareToken) return badRequest("`shareToken` is required");
  if (typeof version !== "number" || version < 1) return badRequest("`version` (number) is required");

  const { shotId } = await ctx.params;
  const shot = await prisma.shot.findUnique({
    where: { id: shotId },
    select: {
      id: true,
      project: { select: { id: true, shareToken: true, isPrivate: true, ownerUserId: true } },
      versions: { where: { version }, select: { id: true } },
    },
  });
  if (!shot || shot.project.shareToken !== shareToken) return notFoundJson();
  if (shot.versions.length === 0) return badRequest(`Version ${version} does not exist`);
  if (shot.project.isPrivate && shot.project.ownerUserId !== sub) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.shot.update({ where: { id: shotId }, data: { selectedVersion: version } });
  emitProjectUpdate(shot.project.id, "shot.selected");
  return Response.json({ selectedVersion: version });
}
