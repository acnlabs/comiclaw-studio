import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { parseBody, withRetry, withRouteErrors } from "@/lib/api";
import { badRequest } from "@/lib/auth";
import { filmVersionSchema } from "@/lib/schemas";
import { nextFilmVersion } from "@/lib/contentVersioning";
import { requireUserContributor } from "@/lib/userContribute";

type Ctx = { params: Promise<{ token: string }> };

export const POST = withRouteErrors(async (req: Request, ctx: Ctx) => {
  const { token } = await ctx.params;
  const gate = await requireUserContributor(req, token);
  if (gate instanceof Response) return gate;

  const body = await parseBody(req, filmVersionSchema);
  const { project, author } = gate;

  const basedOnId = body.basedOnFilmVersionId?.trim() || null;
  if (basedOnId) {
    const base = await prisma.filmVersion.findFirst({
      where: { id: basedOnId, projectId: project.id },
      select: { id: true },
    });
    if (!base) {
      return badRequest("basedOnFilmVersionId must belong to this project");
    }
  }

  const created = await withRetry(async () => {
    const version = await nextFilmVersion(project.id, author.authorKey);
    return prisma.filmVersion.create({
      data: {
        projectId: project.id,
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

  emitProjectUpdate(project.id, "film.version.created");
  return Response.json({ filmVersion: created }, { status: 201 });
});
