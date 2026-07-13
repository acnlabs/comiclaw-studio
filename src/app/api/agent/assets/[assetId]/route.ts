import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { checkApiKey, unauthorized, notFoundJson } from "@/lib/auth";

export async function DELETE(req: Request, ctx: { params: Promise<{ assetId: string }> }) {
  if (!checkApiKey(req)) return unauthorized();
  const { assetId } = await ctx.params;
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, projectId: true },
  });
  if (!asset) return notFoundJson();
  await prisma.asset.delete({ where: { id: assetId } });
  emitProjectUpdate(asset.projectId, "asset.deleted");
  return Response.json({ deleted: true });
}
