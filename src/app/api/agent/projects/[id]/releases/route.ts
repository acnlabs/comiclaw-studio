import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { syncProjectToWork, syncColumnToSeries } from "@/lib/publish";
import { withProjectWorkerAuth, parseBody } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { createReleaseSchema } from "@/lib/schemas";
import { gateAgentProjectAction } from "@/lib/contributeGate";
import type { ProductionAuth } from "@/lib/acnAuth";

type Ctx = { params: Promise<{ id: string }> };

// 新增发行记录
export const POST = withProjectWorkerAuth(async (req, ctx: Ctx, auth: ProductionAuth) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, createReleaseSchema);

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, visibility: true, columnId: true },
  });
  if (!project) return notFoundJson();

  const gated = await gateAgentProjectAction({
    req,
    auth,
    projectId: id,
    projectVisibility: project.visibility,
  });
  if (gated) return gated;

  const created = await prisma.release.create({
    data: {
      projectId: id,
      platform: body.platform,
      url: body.url ?? null,
      status: body.status ?? "PENDING",
      publishedAt: body.publishedAt ?? null,
      notes: body.notes ?? null,
    },
  });

  if (created.status === "PUBLISHED") {
    // 同步失败不影响发行记录创建
    try {
      await syncProjectToWork(id);
      if (project.columnId) await syncColumnToSeries(project.columnId);
    } catch (err) {
      console.error("[releases] work sync failed:", err);
    }
  }
  emitProjectUpdate(id, "release.created");
  return Response.json({ release: created }, { status: 201 });
}, { allowPublicContribute: true });
