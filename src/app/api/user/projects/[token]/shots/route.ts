import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { parseBody, withRetry, withRouteErrors } from "@/lib/api";
import { badRequest, conflict } from "@/lib/auth";
import { createShotSchema } from "@/lib/schemas";
import { nextShotOrder } from "@/lib/contentVersioning";
import { requireUserContributor } from "@/lib/userContribute";

type Ctx = { params: Promise<{ token: string }> };

export const POST = withRouteErrors(async (req: Request, ctx: Ctx) => {
  const { token } = await ctx.params;
  const gate = await requireUserContributor(req, token);
  if (gate instanceof Response) return gate;

  const body = await parseBody(req, createShotSchema);
  const { project, author } = gate;

  const assetIds = body.assetIds ?? [];
  if (assetIds.length > 0) {
    const count = await prisma.asset.count({
      where: { id: { in: assetIds }, projectId: project.id },
    });
    if (count !== new Set(assetIds).size) {
      return badRequest("Some assetIds do not belong to this project");
    }
  }

  if (body.order != null) {
    const dup = await prisma.shot.findUnique({
      where: {
        projectId_authorKey_order: {
          projectId: project.id,
          authorKey: author.authorKey,
          order: body.order,
        },
      },
      select: { id: true },
    });
    if (dup) return conflict(`Shot order ${body.order} already exists`);
  }

  const shot = await withRetry(async () => {
    const order = body.order ?? (await nextShotOrder(project.id, author.authorKey));
    return prisma.shot.create({
      data: {
        projectId: project.id,
        order,
        title: body.title ?? null,
        duration: body.duration ?? null,
        dialogue: body.dialogue ?? null,
        action: body.action ?? null,
        prompt: body.prompt ?? null,
        authorUserId: author.authorUserId,
        authorAgentId: author.authorAgentId,
        authorKey: author.authorKey,
        versions: body.mediaUrl
          ? {
              create: {
                version: 1,
                mediaUrl: body.mediaUrl,
                mediaType: body.mediaType ?? "IMAGE",
                notes: null,
              },
            }
          : undefined,
        assetRefs: { create: assetIds.map((assetId) => ({ assetId })) },
      },
      include: { versions: true, assetRefs: true },
    });
  });

  emitProjectUpdate(project.id, "shot.created");
  return Response.json({ shot }, { status: 201 });
});
