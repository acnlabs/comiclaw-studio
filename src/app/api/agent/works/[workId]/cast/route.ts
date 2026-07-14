import { prisma } from "@/lib/db";
import { withAgentAuth, parseBody } from "@/lib/api";
import { notFoundJson, badRequest } from "@/lib/auth";
import { z } from "zod";

type Ctx = { params: Promise<{ workId: string }> };

const castSchema = z.object({ characterIds: z.array(z.string()).min(0) });

// 设置作品的参演角色(整表替换)
export const POST = withAgentAuth(async (req, ctx: Ctx) => {
  const { workId } = await ctx.params;
  const body = await parseBody(req, castSchema);

  const work = await prisma.work.findUnique({ where: { id: workId }, select: { id: true } });
  if (!work) return notFoundJson();

  if (body.characterIds.length > 0) {
    const count = await prisma.agentCharacter.count({
      where: { id: { in: body.characterIds } },
    });
    if (count !== new Set(body.characterIds).size) {
      return badRequest("Some characterIds do not exist");
    }
  }

  await prisma.$transaction([
    prisma.workCast.deleteMany({ where: { workId } }),
    prisma.workCast.createMany({
      data: body.characterIds.map((characterId) => ({ workId, characterId })),
    }),
  ]);
  return Response.json({ workId, characterIds: body.characterIds });
});
