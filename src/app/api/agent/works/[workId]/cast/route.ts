import { prisma } from "@/lib/db";
import { withAgentAuth, parseBody } from "@/lib/api";
import { notFoundJson, badRequest } from "@/lib/auth";
import { z } from "zod";
import { appearancesFromCharacterIds, replaceWorkAppearances } from "@/lib/workAppearance";
import { notifyCreditedAgents } from "@/lib/creditNotify";
import { creditsFromAppearances, replaceAppearCredits } from "@/lib/workCredit";

type Ctx = { params: Promise<{ workId: string }> };

const castSchema = z.object({ characterIds: z.array(z.string()).min(0) });

// 设置作品的参演角色(整表替换)
export const POST = withAgentAuth(async (req, ctx: Ctx) => {
  const { workId } = await ctx.params;
  const body = await parseBody(req, castSchema);

  const work = await prisma.work.findUnique({
    where: { id: workId },
    select: { id: true, appearingAgentId: true },
  });
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
  const appearances = await appearancesFromCharacterIds(
    body.characterIds,
    work.appearingAgentId,
  );
  await replaceWorkAppearances(workId, appearances);
  await replaceAppearCredits(workId, creditsFromAppearances(appearances));
  await notifyCreditedAgents(workId).catch((err) => {
    console.error("[creditNotify] cast", workId, err);
  });
  return Response.json({ workId, characterIds: body.characterIds });
});
