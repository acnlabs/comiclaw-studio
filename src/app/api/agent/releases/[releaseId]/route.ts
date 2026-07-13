import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { syncProjectToWork } from "@/lib/publish";
import { withAgentAuth, parseBody } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { updateReleaseSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ releaseId: string }> };

// 更新发行状态
export const PATCH = withAgentAuth(async (req, ctx: Ctx) => {
  const { releaseId } = await ctx.params;
  const body = await parseBody(req, updateReleaseSchema);

  const release = await prisma.release.findUnique({
    where: { id: releaseId },
    select: { id: true, projectId: true },
  });
  if (!release) return notFoundJson();

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
    } catch (err) {
      console.error("[releases] syncProjectToWork failed:", err);
    }
  }
  emitProjectUpdate(release.projectId, "release.updated");
  return Response.json({ release: updated });
});

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
