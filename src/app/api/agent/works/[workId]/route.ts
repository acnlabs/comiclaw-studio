import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";

type Ctx = { params: Promise<{ workId: string }> };

export const DELETE = withAgentAuth(async (_req, ctx: Ctx) => {
  const { workId } = await ctx.params;
  const work = await prisma.work.findUnique({ where: { id: workId }, select: { id: true } });
  if (!work) return notFoundJson();
  await prisma.work.delete({ where: { id: workId } });
  return Response.json({ deleted: true });
});
