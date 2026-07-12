import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { checkApiKey, unauthorized, badRequest, notFoundJson } from "@/lib/auth";

// 推送资产新版设定图
export async function POST(req: Request, ctx: { params: Promise<{ assetId: string }> }) {
  if (!checkApiKey(req)) return unauthorized();
  const { assetId } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body?.imageUrl) return badRequest("`imageUrl` is required");

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, projectId: true },
  });
  if (!asset) return notFoundJson();

  const latest = await prisma.assetVersion.findFirst({
    where: { assetId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const created = await prisma.assetVersion.create({
    data: {
      assetId,
      version: (latest?.version ?? 0) + 1,
      imageUrl: body.imageUrl,
      notes: body.notes ?? null,
    },
  });
  emitProjectUpdate(asset.projectId, "asset.version.created");
  return Response.json({ assetVersion: created }, { status: 201 });
}
