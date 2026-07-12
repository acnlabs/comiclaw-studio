import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { checkApiKey, unauthorized, badRequest, notFoundJson } from "@/lib/auth";

// 推送分镜新版画面(图或视频)
export async function POST(req: Request, ctx: { params: Promise<{ shotId: string }> }) {
  if (!checkApiKey(req)) return unauthorized();
  const { shotId } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body?.mediaUrl) return badRequest("`mediaUrl` is required");

  const shot = await prisma.shot.findUnique({
    where: { id: shotId },
    select: { id: true, projectId: true },
  });
  if (!shot) return notFoundJson();

  const latest = await prisma.shotVersion.findFirst({
    where: { shotId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const created = await prisma.shotVersion.create({
    data: {
      shotId,
      version: (latest?.version ?? 0) + 1,
      mediaUrl: body.mediaUrl,
      mediaType: body.mediaType ?? "IMAGE",
      notes: body.notes ?? null,
    },
  });
  emitProjectUpdate(shot.projectId, "shot.version.created");
  return Response.json({ shotVersion: created }, { status: 201 });
}
