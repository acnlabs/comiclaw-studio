import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withAgentAuth, withProjectWorkerAuth, parseBody } from "@/lib/api";
import { notFoundJson, forbidden } from "@/lib/auth";
import { updateProjectSchema } from "@/lib/schemas";
import type { ProductionAuth } from "@/lib/acnAuth";

type Ctx = { params: Promise<{ id: string }> };

// 读取项目全量数据(官方 key 或已绑定任务的 ACN 工人)
export const GET = withProjectWorkerAuth(async (_req, ctx: Ctx) => {
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
});

// 删除项目:仅官方 STUDIO_API_KEY
export const DELETE = withAgentAuth(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const exists = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return notFoundJson();
  await prisma.project.delete({ where: { id } });
  return Response.json({ deleted: true });
});

// 更新项目信息 / 推进阶段
// ACN 工人仅允许 statusNote / currentStage,避免改名或改归属类字段
export const PATCH = withProjectWorkerAuth(async (req, ctx: Ctx, auth: ProductionAuth) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, updateProjectSchema);

  if (auth.kind === "acn_worker") {
    const forbiddenKeys = ["name", "clientName", "agentName", "description", "coverUrl"] as const;
    for (const k of forbiddenKeys) {
      if (body[k] !== undefined) {
        return forbidden(`ACN workers may only update statusNote/currentStage (got ${k})`);
      }
    }
  }

  const exists = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return notFoundJson();

  const project = await prisma.project.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      clientName: body.clientName === undefined ? undefined : body.clientName,
      agentName: body.agentName === undefined ? undefined : body.agentName,
      description: body.description === undefined ? undefined : body.description,
      coverUrl: body.coverUrl === undefined ? undefined : body.coverUrl,
      currentStage: body.currentStage ?? undefined,
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
