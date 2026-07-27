import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withProjectWorkerAuth, parseBody } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { createAssetSchema } from "@/lib/schemas";
import { resolveAgentCreateAuthor } from "@/lib/contentAuthor";
import { gateAgentContentCreate } from "@/lib/contributeGate";
import type { ProductionAuth } from "@/lib/acnAuth";

type Ctx = { params: Promise<{ id: string }> };

// 创建资产(可携带首版设定图)
export const POST = withProjectWorkerAuth(async (req, ctx: Ctx, auth: ProductionAuth) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, createAssetSchema);

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

  const asset = await prisma.asset.create({
    data: {
      projectId: id,
      type: body.type,
      name: body.name,
      description: body.description ?? null,
      authorUserId: author.authorUserId,
      authorAgentId: author.authorAgentId,
      authorKey: author.authorKey,
      versions: body.imageUrl
        ? {
            create: {
              version: 1,
              imageUrl: body.imageUrl,
              audioUrl: body.audioUrl ?? null,
              notes: body.notes ?? null,
            },
          }
        : undefined,
    },
    include: { versions: true },
  });
  emitProjectUpdate(id, "asset.created");
  return Response.json({ asset }, { status: 201 });
});
