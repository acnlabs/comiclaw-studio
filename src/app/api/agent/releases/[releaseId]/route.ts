import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { syncProjectToWork } from "@/lib/publish";
import { checkApiKey, unauthorized, badRequest, notFoundJson } from "@/lib/auth";

// 更新发行状态(如上架成功后回填链接)
export async function PATCH(req: Request, ctx: { params: Promise<{ releaseId: string }> }) {
  if (!checkApiKey(req)) return unauthorized();
  const { releaseId } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const release = await prisma.release.findUnique({
    where: { id: releaseId },
    select: { id: true, projectId: true },
  });
  if (!release) return notFoundJson();

  const updated = await prisma.release.update({
    where: { id: releaseId },
    data: {
      url: body.url ?? undefined,
      status: body.status ?? undefined,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : undefined,
      notes: body.notes ?? undefined,
    },
  });
  if (updated.status === "PUBLISHED") {
    await syncProjectToWork(release.projectId);
  }
  emitProjectUpdate(release.projectId, "release.updated");
  return Response.json({ release: updated });
}
