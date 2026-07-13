import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { checkApiKey, unauthorized, badRequest, notFoundJson } from "@/lib/auth";

export async function PATCH(req: Request, ctx: { params: Promise<{ shotId: string }> }) {
  if (!checkApiKey(req)) return unauthorized();
  const { shotId } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const shot = await prisma.shot.findUnique({
    where: { id: shotId },
    select: { id: true, projectId: true },
  });
  if (!shot) return notFoundJson();

  const updated = await prisma.shot.update({
    where: { id: shotId },
    data: {
      title: body.title ?? undefined,
      duration: body.duration ?? undefined,
      dialogue: body.dialogue ?? undefined,
      action: body.action ?? undefined,
      assetRefs: Array.isArray(body.assetIds)
        ? {
            deleteMany: {},
            create: body.assetIds.map((assetId: string) => ({ assetId })),
          }
        : undefined,
    },
  });
  emitProjectUpdate(shot.projectId, "shot.updated");
  return Response.json({ shot: updated });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ shotId: string }> }) {
  if (!checkApiKey(req)) return unauthorized();
  const { shotId } = await ctx.params;
  const shot = await prisma.shot.findUnique({
    where: { id: shotId },
    select: { id: true, projectId: true },
  });
  if (!shot) return notFoundJson();
  await prisma.shot.delete({ where: { id: shotId } });
  emitProjectUpdate(shot.projectId, "shot.deleted");
  return Response.json({ deleted: true });
}
