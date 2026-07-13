import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withAgentAuth, parseBody } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { createAssetSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

// 创建资产(可携带首版设定图)
export const POST = withAgentAuth(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, createAssetSchema);

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return notFoundJson();

  const asset = await prisma.asset.create({
    data: {
      projectId: id,
      type: body.type,
      name: body.name,
      description: body.description ?? null,
      versions: body.imageUrl
        ? { create: { version: 1, imageUrl: body.imageUrl, notes: body.notes ?? null } }
        : undefined,
    },
    include: { versions: true },
  });
  emitProjectUpdate(id, "asset.created");
  return Response.json({ asset }, { status: 201 });
});
