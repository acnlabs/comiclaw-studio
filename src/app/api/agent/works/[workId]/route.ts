import { prisma } from "@/lib/db";
import { checkApiKey, unauthorized, notFoundJson } from "@/lib/auth";

export async function DELETE(req: Request, ctx: { params: Promise<{ workId: string }> }) {
  if (!checkApiKey(req)) return unauthorized();
  const { workId } = await ctx.params;
  const work = await prisma.work.findUnique({ where: { id: workId }, select: { id: true } });
  if (!work) return notFoundJson();
  await prisma.work.delete({ where: { id: workId } });
  return Response.json({ deleted: true });
}
