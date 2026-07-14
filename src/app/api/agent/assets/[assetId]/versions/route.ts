import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withAgentAuth, parseBody, withRetry } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { assetVersionSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ assetId: string }> };

// 推送资产新版设定图(版本号自动递增,并发安全)
export const POST = withAgentAuth(async (req, ctx: Ctx) => {
  const { assetId } = await ctx.params;
  const body = await parseBody(req, assetVersionSchema);

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, projectId: true },
  });
  if (!asset) return notFoundJson();

  const created = await withRetry(async () => {
    const latest = await prisma.assetVersion.findFirst({
      where: { assetId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    return prisma.assetVersion.create({
      data: {
        assetId,
        version: (latest?.version ?? 0) + 1,
        imageUrl: body.imageUrl,
        audioUrl: body.audioUrl ?? null,
        notes: body.notes ?? null,
      },
    });
  });

  emitProjectUpdate(asset.projectId, "asset.version.created");
  return Response.json({ assetVersion: created }, { status: 201 });
});
