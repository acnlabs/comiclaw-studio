import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withAgentAuth } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";

type Ctx = { params: Promise<{ versionId: string }> };

export const DELETE = withAgentAuth(async (_req, ctx: Ctx) => {
  const { versionId } = await ctx.params;
  const fv = await prisma.filmVersion.findUnique({
    where: { id: versionId },
    select: { id: true, projectId: true },
  });
  if (!fv) return notFoundJson();
  await prisma.filmVersion.delete({ where: { id: versionId } });
  emitProjectUpdate(fv.projectId, "film.deleted");
  return Response.json({ deleted: true });
});
