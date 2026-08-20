import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { syncProjectToWork, syncColumnToSeries, syncDramaToSeries } from "@/lib/publish";
import { withAgentAuth, withProjectWorkerAuth, parseBody } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { updateReleaseSchema } from "@/lib/schemas";
import { gateAgentProjectAction } from "@/lib/contributeGate";
import type { ProductionAuth } from "@/lib/acnAuth";

type Ctx = { params: Promise<{ releaseId: string }> };

const releaseProjectId = async (_req: Request, ctx: Ctx) => {
  const { releaseId } = await ctx.params;
  const release = await prisma.release.findUnique({
    where: { id: releaseId },
    select: { projectId: true },
  });
  return release?.projectId ?? null;
};

// 更新发行状态
export const PATCH = withProjectWorkerAuth(
  async (req, ctx: Ctx, auth: ProductionAuth) => {
    const { releaseId } = await ctx.params;
    const body = await parseBody(req, updateReleaseSchema);

    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      select: {
        id: true,
        projectId: true,
        project: { select: { visibility: true, columnId: true, dramaProjectId: true } },
      },
    });
    if (!release) return notFoundJson();

    const gated = await gateAgentProjectAction({
      req,
      auth,
      projectId: release.projectId,
      projectVisibility: release.project.visibility,
    });
    if (gated) return gated;

    const updated = await prisma.release.update({
      where: { id: releaseId },
      data: {
        url: body.url === undefined ? undefined : body.url,
        status: body.status ?? undefined,
        publishedAt: body.publishedAt === undefined ? undefined : body.publishedAt,
        notes: body.notes === undefined ? undefined : body.notes,
      },
    });

    if (updated.status === "PUBLISHED") {
      try {
        await syncProjectToWork(release.projectId);
        const columnId = release.project.columnId;
        if (columnId) await syncColumnToSeries(columnId);
        if (release.project.dramaProjectId) {
          await syncDramaToSeries(release.project.dramaProjectId);
        }
      } catch (err) {
        console.error("[releases] work sync failed:", err);
      }
    }
    emitProjectUpdate(release.projectId, "release.updated");
    return Response.json({ release: updated });
  },
  { getProjectId: releaseProjectId, allowPublicContribute: true }
);

export const DELETE = withAgentAuth(async (_req, ctx: Ctx) => {
  const { releaseId } = await ctx.params;
  const release = await prisma.release.findUnique({
    where: { id: releaseId },
    select: { id: true, projectId: true },
  });
  if (!release) return notFoundJson();
  await prisma.release.delete({ where: { id: releaseId } });
  emitProjectUpdate(release.projectId, "release.deleted");
  return Response.json({ deleted: true });
});
