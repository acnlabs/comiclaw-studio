import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { syncProjectToWork } from "@/lib/publish";
import { withAgentAuth, parseBody } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { createReleaseSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

// 新增发行记录
export const POST = withAgentAuth(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, createReleaseSchema);

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return notFoundJson();

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
    } catch (err) {
      console.error("[releases] syncProjectToWork failed:", err);
    }
  }
  emitProjectUpdate(id, "release.created");
  return Response.json({ release: created }, { status: 201 });
});
