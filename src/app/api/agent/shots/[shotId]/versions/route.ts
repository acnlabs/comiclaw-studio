import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withAgentAuth, parseBody, withRetry } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { shotVersionSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ shotId: string }> };

// 推送分镜新版画面(版本号自动递增,并发安全)
export const POST = withAgentAuth(async (req, ctx: Ctx) => {
  const { shotId } = await ctx.params;
  const body = await parseBody(req, shotVersionSchema);

  const shot = await prisma.shot.findUnique({
    where: { id: shotId },
    select: { id: true, projectId: true },
  });
  if (!shot) return notFoundJson();

  const created = await withRetry(async () => {
    const latest = await prisma.shotVersion.findFirst({
      where: { shotId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    return prisma.shotVersion.create({
      data: {
        shotId,
        version: (latest?.version ?? 0) + 1,
        mediaUrl: body.mediaUrl,
        mediaType: body.mediaType ?? "IMAGE",
        notes: body.notes ?? null,
      },
    });
  });

  emitProjectUpdate(shot.projectId, "shot.version.created");
  return Response.json({ shotVersion: created }, { status: 201 });
});
