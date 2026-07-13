import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { checkApiKey, unauthorized, notFoundJson } from "@/lib/auth";

export async function DELETE(req: Request, ctx: { params: Promise<{ versionId: string }> }) {
  if (!checkApiKey(req)) return unauthorized();
  const { versionId } = await ctx.params;
  const fv = await prisma.filmVersion.findUnique({
    where: { id: versionId },
    select: { id: true, projectId: true },
  });
  if (!fv) return notFoundJson();
  await prisma.filmVersion.delete({ where: { id: versionId } });
  emitProjectUpdate(fv.projectId, "film.deleted");
  return Response.json({ deleted: true });
}
