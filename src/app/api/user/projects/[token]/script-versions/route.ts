import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { parseBody, withRetry, withRouteErrors } from "@/lib/api";
import { scriptVersionSchema } from "@/lib/schemas";
import { nextScriptVersion } from "@/lib/contentVersioning";
import { requireUserContributor } from "@/lib/userContribute";

type Ctx = { params: Promise<{ token: string }> };

export const POST = withRouteErrors(async (req: Request, ctx: Ctx) => {
  const { token } = await ctx.params;
  const gate = await requireUserContributor(req, token);
  if (gate instanceof Response) return gate;

  const body = await parseBody(req, scriptVersionSchema);
  const { project, author } = gate;

  const created = await withRetry(async () => {
    const version = await nextScriptVersion(project.id, author.authorKey);
    return prisma.scriptVersion.create({
      data: {
        projectId: project.id,
        version,
        title: body.title ?? null,
        logline: body.logline ?? null,
        content: body.content,
        changeLog: body.changeLog ?? null,
        authorUserId: author.authorUserId,
        authorAgentId: author.authorAgentId,
        authorKey: author.authorKey,
      },
    });
  });

  emitProjectUpdate(project.id, "script.created");
  return Response.json({ scriptVersion: created }, { status: 201 });
});
