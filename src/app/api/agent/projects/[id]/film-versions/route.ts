import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { checkApiKey, unauthorized, badRequest, notFoundJson } from "@/lib/auth";

// 推送成片新版本
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!checkApiKey(req)) return unauthorized();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body?.videoUrl) return badRequest("`videoUrl` is required");

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return notFoundJson();

  const latest = await prisma.filmVersion.findFirst({
    where: { projectId: id },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const created = await prisma.filmVersion.create({
    data: {
      projectId: id,
      version: (latest?.version ?? 0) + 1,
      videoUrl: body.videoUrl,
      duration: body.duration ?? null,
      notes: body.notes ?? null,
    },
  });
  emitProjectUpdate(id, "film.version.created");
  return Response.json({ filmVersion: created }, { status: 201 });
}
