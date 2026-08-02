import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withAgentAuth, withProjectWorkerAuth, parseBody } from "@/lib/api";
import { notFoundJson, forbidden, badRequest, conflict } from "@/lib/auth";
import { updateProjectSchema } from "@/lib/schemas";
import { blocksProjectDelete, PUBLISH_DRAFT } from "@/lib/assetPublish";
import type { ProductionAuth } from "@/lib/acnAuth";

type Ctx = { params: Promise<{ id: string }> };

// 读取项目全量数据(官方 key 或已绑定任务的 ACN 工人)
export const GET = withProjectWorkerAuth(
  async (_req, ctx: Ctx) => {
    const { id } = await ctx.params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        scriptVersions: { orderBy: { version: "desc" } },
        assets: { include: { versions: { orderBy: { version: "desc" } } } },
        shots: {
          orderBy: { order: "asc" },
          include: {
            versions: { orderBy: { version: "desc" } },
            assetRefs: { include: { asset: { select: { id: true, name: true, type: true } } } },
          },
        },
        filmVersions: { orderBy: { version: "desc" } },
        releases: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!project) return notFoundJson();
    return Response.json({ project });
  },
  { access: "read", allowPublicContribute: true }
);

// 删除项目:仅官方 STUDIO_API_KEY
export const DELETE = withAgentAuth(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const exists = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return notFoundJson();

  // Assets cascade with the project. A published one is registered on
  // AgentPlanet and may be licensed by other projects, so it has to be
  // withdrawn deliberately rather than vanish with its origin. Count and
  // delete share one serializable transaction: a publish landing between the
  // two would otherwise cascade a live registration away.
  // 这一记的二创归别人所有,删掉锚点就把整记连人家的项目一起带走了
  const coCreations = await prisma.project.count({ where: { parentProjectId: id } });
  if (coCreations > 0) {
    return conflict(
      `This entry anchors ${coCreations} co-creation projects owned by others; it cannot be deleted`
    );
  }

  const publishedAssets = await prisma.$transaction(
    async (tx) => {
      const count = await tx.asset.count({
        where: { projectId: id, publishState: { not: PUBLISH_DRAFT } },
      });
      if (blocksProjectDelete(count)) return count;
      await tx.project.delete({ where: { id } });
      return 0;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  if (blocksProjectDelete(publishedAssets)) {
    return conflict(
      `Project has ${publishedAssets} registered assets; withdraw them before deleting`
    );
  }

  return Response.json({ deleted: true });
});

// 更新项目信息 / 推进阶段
// ACN 工人仅允许 statusNote / currentStage,避免改名或改归属类字段
export const PATCH = withProjectWorkerAuth(async (req, ctx: Ctx, auth: ProductionAuth) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, updateProjectSchema);

  if (auth.kind === "acn_contributor") {
    return forbidden("ACN contributors cannot update project settings");
  }
  if (auth.kind === "acn_worker") {
    const forbiddenKeys = [
      "name",
      "clientName",
      "agentName",
      "description",
      "coverUrl",
      "visibility",
      "columnId",
      "entryOrder",
      "acnOrgId",
      "contributePolicy",
    ] as const;
    for (const k of forbiddenKeys) {
      if (body[k] !== undefined) {
        return forbidden(`ACN workers may only update statusNote/currentStage (got ${k})`);
      }
    }
  }

  const exists = await prisma.project.findUnique({
    where: { id },
    select: { id: true, visibility: true, columnId: true },
  });
  if (!exists) return notFoundJson();

  const nextVisibility = body.visibility ?? exists.visibility;
  const nextColumnId =
    body.columnId === undefined
      ? exists.columnId
      : body.columnId?.trim() || null;

  if (body.columnId !== undefined && nextColumnId) {
    const column = await prisma.column.findUnique({
      where: { id: nextColumnId },
      select: { id: true },
    });
    if (!column) return notFoundJson("Column not found");
  }
  if (body.entryOrder != null && !nextColumnId) {
    return badRequest("entryOrder requires columnId");
  }

  const project = await prisma.project.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      clientName: body.clientName === undefined ? undefined : body.clientName,
      agentName: body.agentName === undefined ? undefined : body.agentName,
      description: body.description === undefined ? undefined : body.description,
      coverUrl: body.coverUrl === undefined ? undefined : body.coverUrl,
      currentStage: body.currentStage ?? undefined,
      visibility: body.visibility ?? undefined,
      columnId: body.columnId === undefined ? undefined : nextColumnId,
      entryOrder: body.entryOrder === undefined ? undefined : body.entryOrder,
      acnOrgId:
        body.acnOrgId === undefined
          ? undefined
          : body.acnOrgId?.trim() || null,
      contributePolicy:
        body.contributePolicy === undefined ? undefined : body.contributePolicy,
      ...(nextVisibility === "PUBLIC" ? { isPrivate: false } : {}),
      statusNote:
        body.statusNote === undefined
          ? body.currentStage // 推进阶段时自动清空上一阶段的状态
            ? null
            : undefined
          : body.statusNote?.trim() || null,
    },
  });
  emitProjectUpdate(id, "project.updated");
  return Response.json({ project });
});
