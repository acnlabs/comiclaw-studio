import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { checkApiKey, unauthorized, notFoundJson } from "@/lib/auth";

export async function DELETE(req: Request, ctx: { params: Promise<{ versionId: string }> }) {
  if (!checkApiKey(req)) return unauthorized();
  const { versionId } = await ctx.params;
  const sv = await prisma.scriptVersion.findUnique({
    where: { id: versionId },
    select: { id: true, projectId: true },
  });
  if (!sv) return notFoundJson();
  await prisma.scriptVersion.delete({ where: { id: versionId } });
  emitProjectUpdate(sv.projectId, "script.deleted");
  return Response.json({ deleted: true });
}
