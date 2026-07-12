import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { checkApiKey, unauthorized, badRequest, notFoundJson } from "@/lib/auth";

const VALID_TYPES = ["CHARACTER", "SCENE", "PROP"];

// 创建资产(可携带首版设定图)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!checkApiKey(req)) return unauthorized();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body?.name) return badRequest("`name` is required");
  if (!VALID_TYPES.includes(body.type)) {
    return badRequest(`type must be one of ${VALID_TYPES.join(", ")}`);
  }

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
}
