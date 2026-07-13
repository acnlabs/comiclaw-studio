import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withAgentAuth } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";

type Ctx = { params: Promise<{ versionId: string }> };

export const DELETE = withAgentAuth(async (_req, ctx: Ctx) => {
  const { versionId } = await ctx.params;
  const sv = await prisma.scriptVersion.findUnique({
    where: { id: versionId },
    select: { id: true, projectId: true },
  });
  if (!sv) return notFoundJson();
  await prisma.scriptVersion.delete({ where: { id: versionId } });
  emitProjectUpdate(sv.projectId, "script.deleted");
  return Response.json({ deleted: true });
});
