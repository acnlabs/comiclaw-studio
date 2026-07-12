import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { checkApiKey, unauthorized, badRequest, notFoundJson } from "@/lib/auth";

// 推送新版剧本(版本号自动递增)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!checkApiKey(req)) return unauthorized();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body?.content) return badRequest("`content` is required");

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return notFoundJson();

  const latest = await prisma.scriptVersion.findFirst({
    where: { projectId: id },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const created = await prisma.scriptVersion.create({
    data: {
      projectId: id,
      version: (latest?.version ?? 0) + 1,
      title: body.title ?? null,
      logline: body.logline ?? null,
      content: body.content,
      changeLog: body.changeLog ?? null,
    },
  });
  emitProjectUpdate(id, "script.created");
  return Response.json({ scriptVersion: created }, { status: 201 });
}
