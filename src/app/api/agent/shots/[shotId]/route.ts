import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withAgentAuth, parseBody } from "@/lib/api";
import { notFoundJson, badRequest } from "@/lib/auth";
import { updateShotSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ shotId: string }> };

// 更新分镜文字信息 / 资产引用
export const PATCH = withAgentAuth(async (req, ctx: Ctx) => {
  const { shotId } = await ctx.params;
  const body = await parseBody(req, updateShotSchema);

  const shot = await prisma.shot.findUnique({
    where: { id: shotId },
    select: { id: true, projectId: true },
  });
  if (!shot) return notFoundJson();

  if (body.assetIds && body.assetIds.length > 0) {
    const count = await prisma.asset.count({
      where: { id: { in: body.assetIds }, projectId: shot.projectId },
    });
    if (count !== new Set(body.assetIds).size) {
      return badRequest("Some assetIds do not belong to this project");
    }
  }

  const updated = await prisma.shot.update({
    where: { id: shotId },
    data: {
      title: body.title === undefined ? undefined : body.title,
      duration: body.duration === undefined ? undefined : body.duration,
      dialogue: body.dialogue === undefined ? undefined : body.dialogue,
      action: body.action === undefined ? undefined : body.action,
      assetRefs: body.assetIds
        ? { deleteMany: {}, create: body.assetIds.map((assetId) => ({ assetId })) }
        : undefined,
    },
  });
  emitProjectUpdate(shot.projectId, "shot.updated");
  return Response.json({ shot: updated });
});

export const DELETE = withAgentAuth(async (_req, ctx: Ctx) => {
  const { shotId } = await ctx.params;
  const shot = await prisma.shot.findUnique({
    where: { id: shotId },
    select: { id: true, projectId: true },
  });
  if (!shot) return notFoundJson();
  await prisma.shot.delete({ where: { id: shotId } });
  emitProjectUpdate(shot.projectId, "shot.deleted");
  return Response.json({ deleted: true });
});
