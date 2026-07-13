import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withAgentAuth } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";

type Ctx = { params: Promise<{ assetId: string }> };

export const DELETE = withAgentAuth(async (_req, ctx: Ctx) => {
  const { assetId } = await ctx.params;
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, projectId: true },
  });
  if (!asset) return notFoundJson();
  await prisma.asset.delete({ where: { id: assetId } });
  emitProjectUpdate(asset.projectId, "asset.deleted");
  return Response.json({ deleted: true });
});
