import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withAgentAuth, parseBody } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { updateProjectSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

// 读取项目全量数据
export const GET = withAgentAuth(async (_req, ctx: Ctx) => {
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

// 删除项目(级联删除交付物与关联作品)
export const DELETE = withAgentAuth(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const exists = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return notFoundJson();
  await prisma.project.delete({ where: { id } });
  return Response.json({ deleted: true });
});

// 更新项目信息 / 推进阶段
export const PATCH = withAgentAuth(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, updateProjectSchema);

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
