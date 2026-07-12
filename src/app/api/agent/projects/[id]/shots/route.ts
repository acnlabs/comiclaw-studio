import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { checkApiKey, unauthorized, badRequest, notFoundJson } from "@/lib/auth";

// 创建分镜(可携带首版画面与资产引用)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!checkApiKey(req)) return unauthorized();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.order !== "number") return badRequest("`order` (number) is required");

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return notFoundJson();

  const dup = await prisma.shot.findUnique({
    where: { projectId_order: { projectId: id, order: body.order } },
    select: { id: true },
  });
  if (dup) return Response.json({ error: `Shot order ${body.order} already exists` }, { status: 409 });

  const assetIds: string[] = Array.isArray(body.assetIds) ? body.assetIds : [];

  const shot = await prisma.shot.create({
    data: {
      projectId: id,
      order: body.order,
      title: body.title ?? null,
      duration: body.duration ?? null,
      dialogue: body.dialogue ?? null,
      action: body.action ?? null,
      versions: body.mediaUrl
        ? {
            create: {
              version: 1,
              mediaUrl: body.mediaUrl,
              mediaType: body.mediaType ?? "IMAGE",
              notes: body.notes ?? null,
            },
          }
        : undefined,
      assetRefs: { create: assetIds.map((assetId) => ({ assetId })) },
    },
    include: { versions: true, assetRefs: true },
  });
  emitProjectUpdate(id, "shot.created");
  return Response.json({ shot }, { status: 201 });
}
