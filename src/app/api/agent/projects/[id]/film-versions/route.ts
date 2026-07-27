import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withProjectWorkerAuth, parseBody, withRetry } from "@/lib/api";
import { notFoundJson, badRequest } from "@/lib/auth";
import { filmVersionSchema } from "@/lib/schemas";
import { resolveAgentCreateAuthor } from "@/lib/contentAuthor";
import { nextFilmVersion } from "@/lib/contentVersioning";
import { gateAgentContentCreate } from "@/lib/contributeGate";
import type { ProductionAuth } from "@/lib/acnAuth";

type Ctx = { params: Promise<{ id: string }> };

// 推送成片新版本(按 authorKey 版本号递增)
export const POST = withProjectWorkerAuth(async (req, ctx: Ctx, auth: ProductionAuth) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, filmVersionSchema);

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

  const basedOnId = body.basedOnFilmVersionId?.trim() || null;
  if (basedOnId) {
    const base = await prisma.filmVersion.findFirst({
      where: { id: basedOnId, projectId: id },
      select: { id: true },
    });
    if (!base) return badRequest("basedOnFilmVersionId must belong to this project");
  }

  const created = await withRetry(async () => {
    const version = await nextFilmVersion(id, author.authorKey);
    return prisma.filmVersion.create({
      data: {
        projectId: id,
        version,
        videoUrl: body.videoUrl,
        duration: body.duration ?? null,
        notes: body.notes ?? null,
        authorUserId: author.authorUserId,
        authorAgentId: author.authorAgentId,
        authorKey: author.authorKey,
        basedOnFilmVersionId: basedOnId,
      },
    });
  });

  emitProjectUpdate(id, "film.version.created");
  return Response.json({ filmVersion: created }, { status: 201 });
});
