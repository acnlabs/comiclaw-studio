import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { checkApiKey, unauthorized, badRequest, notFoundJson } from "@/lib/auth";

// 新增发行记录
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!checkApiKey(req)) return unauthorized();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body?.platform) return badRequest("`platform` is required");

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return notFoundJson();

  const created = await prisma.release.create({
    data: {
      projectId: id,
      platform: body.platform,
      url: body.url ?? null,
      status: body.status ?? "PENDING",
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
      notes: body.notes ?? null,
    },
  });
  emitProjectUpdate(id, "release.created");
  return Response.json({ release: created }, { status: 201 });
}
