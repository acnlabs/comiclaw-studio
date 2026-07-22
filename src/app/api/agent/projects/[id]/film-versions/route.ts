import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withProjectWorkerAuth, parseBody, withRetry } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { filmVersionSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

// 推送成片新版本(版本号自动递增,并发安全)
export const POST = withProjectWorkerAuth(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, filmVersionSchema);

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return notFoundJson();

  const created = await withRetry(async () => {
    const latest = await prisma.filmVersion.findFirst({
      where: { projectId: id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    return prisma.filmVersion.create({
      data: {
        projectId: id,
        version: (latest?.version ?? 0) + 1,
        videoUrl: body.videoUrl,
        duration: body.duration ?? null,
        notes: body.notes ?? null,
      },
    });
  });

  emitProjectUpdate(id, "film.version.created");
  return Response.json({ filmVersion: created }, { status: 201 });
});
