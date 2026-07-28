import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withProjectWorkerAuth, parseBody, withRetry } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { scriptVersionSchema } from "@/lib/schemas";
import { resolveAgentCreateAuthor } from "@/lib/contentAuthor";
import { nextScriptVersion } from "@/lib/contentVersioning";
import { gateAgentContentCreate } from "@/lib/contributeGate";
import type { ProductionAuth } from "@/lib/acnAuth";

type Ctx = { params: Promise<{ id: string }> };

// 推送新版剧本(按 authorKey 版本号递增)
export const POST = withProjectWorkerAuth(
  async (req, ctx: Ctx, auth: ProductionAuth) => {
    const { id } = await ctx.params;
    const body = await parseBody(req, scriptVersionSchema);

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

    const created = await withRetry(async () => {
      const version = await nextScriptVersion(id, author.authorKey);
      return prisma.scriptVersion.create({
        data: {
          projectId: id,
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

    emitProjectUpdate(id, "script.created");
    return Response.json({ scriptVersion: created }, { status: 201 });
  },
  { allowPublicContribute: true }
);
