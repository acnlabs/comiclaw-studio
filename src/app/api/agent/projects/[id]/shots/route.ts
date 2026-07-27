import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withProjectWorkerAuth, parseBody, withRetry } from "@/lib/api";
import { notFoundJson, badRequest, conflict } from "@/lib/auth";
import { createShotSchema } from "@/lib/schemas";
import { resolveAgentCreateAuthor } from "@/lib/contentAuthor";
import { nextShotOrder } from "@/lib/contentVersioning";
import { gateAgentContentCreate } from "@/lib/contributeGate";
import type { ProductionAuth } from "@/lib/acnAuth";

type Ctx = { params: Promise<{ id: string }> };

// 创建分镜(可携带首版画面与资产引用)
export const POST = withProjectWorkerAuth(async (req, ctx: Ctx, auth: ProductionAuth) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, createShotSchema);

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, visibility: true },
  });
  if (!project) return notFoundJson();

  const author = resolveAgentCreateAuthor({
    auth,
    visibility: project.visibility,
    authorUserId: body.authorUserId,
    authorAgentId: body.authorAgentId,
  });
  if (author instanceof Response) return author;

  const gated = await gateAgentContentCreate({
    req,
    auth,
    projectId: id,
    projectVisibility: project.visibility,
    author,
  });
  if (gated) return gated;

  const assetIds = body.assetIds ?? [];
  if (assetIds.length > 0) {
    const count = await prisma.asset.count({
      where: { id: { in: assetIds }, projectId: id },
    });
    if (count !== new Set(assetIds).size) {
      return badRequest("Some assetIds do not belong to this project");
    }
  }

  if (body.order != null) {
    const dup = await prisma.shot.findUnique({
      where: {
        projectId_authorKey_order: {
          projectId: id,
          authorKey: author.authorKey,
          order: body.order,
        },
      },
      select: { id: true },
    });
    if (dup) return conflict(`Shot order ${body.order} already exists`);
  }

  const shot = await withRetry(async () => {
    const order = body.order ?? (await nextShotOrder(id, author.authorKey));
    return prisma.shot.create({
      data: {
        projectId: id,
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

  emitProjectUpdate(id, "shot.created");
  return Response.json({ shot }, { status: 201 });
});
