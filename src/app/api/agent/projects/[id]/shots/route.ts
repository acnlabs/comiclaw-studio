import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withAgentAuth, parseBody } from "@/lib/api";
import { notFoundJson, badRequest, conflict } from "@/lib/auth";
import { createShotSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

// 创建分镜(可携带首版画面与资产引用)
export const POST = withAgentAuth(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, createShotSchema);

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return notFoundJson();

  const dup = await prisma.shot.findUnique({
    where: { projectId_order: { projectId: id, order: body.order } },
    select: { id: true },
  });
  if (dup) return conflict(`Shot order ${body.order} already exists`);

  const assetIds = body.assetIds ?? [];
  if (assetIds.length > 0) {
    // 校验引用的资产都属于当前项目,防止跨项目引用
    const count = await prisma.asset.count({
      where: { id: { in: assetIds }, projectId: id },
    });
    if (count !== new Set(assetIds).size) {
      return badRequest("Some assetIds do not belong to this project");
    }
  }

  const shot = await prisma.shot.create({
    data: {
      projectId: id,
      order: body.order,
      title: body.title ?? null,
      duration: body.duration ?? null,
      dialogue: body.dialogue ?? null,
      action: body.action ?? null,
      versions: body.mediaUrl
        ? {
            create: {
              version: 1,
              mediaUrl: body.mediaUrl,
              mediaType: body.mediaType ?? "IMAGE",
              notes: null,
            },
          }
        : undefined,
      assetRefs: { create: assetIds.map((assetId) => ({ assetId })) },
    },
    include: { versions: true, assetRefs: true },
  });
  emitProjectUpdate(id, "shot.created");
  return Response.json({ shot }, { status: 201 });
});
