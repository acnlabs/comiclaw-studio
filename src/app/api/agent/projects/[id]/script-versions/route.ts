import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withAgentAuth, parseBody, withRetry } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { scriptVersionSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

// 推送新版剧本(版本号自动递增,并发安全)
export const POST = withAgentAuth(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, scriptVersionSchema);

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return notFoundJson();

  const created = await withRetry(async () => {
    const latest = await prisma.scriptVersion.findFirst({
      where: { projectId: id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    return prisma.scriptVersion.create({
      data: {
        projectId: id,
        version: (latest?.version ?? 0) + 1,
        title: body.title ?? null,
        logline: body.logline ?? null,
        content: body.content,
        changeLog: body.changeLog ?? null,
      },
    });
  });

  emitProjectUpdate(id, "script.created");
  return Response.json({ scriptVersion: created }, { status: 201 });
});
