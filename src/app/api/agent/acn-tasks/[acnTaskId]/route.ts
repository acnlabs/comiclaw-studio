import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { getAcnTask, acnProductionConfigured } from "@/lib/acn";

type Ctx = { params: Promise<{ acnTaskId: string }> };

// 查 Studio 映射 + (可选)实时拉 ACN 任务状态。状态权威在 ACN。
export const GET = withAgentAuth(async (req, ctx: Ctx) => {
  const { acnTaskId } = await ctx.params;
  const ref = await prisma.acnTaskRef.findUnique({
    where: { acnTaskId },
    include: {
      project: {
        select: { id: true, name: true, shareToken: true, ownerUserId: true, currentStage: true },
      },
    },
  });
  if (!ref) return notFoundJson();

  const live = new URL(req.url).searchParams.get("live") !== "0";
  let task = null;
  let acnError: string | null = null;
  if (live && acnProductionConfigured()) {
    try {
      task = await getAcnTask(acnTaskId);
    } catch (err) {
      acnError = err instanceof Error ? err.message : String(err);
    }
  }

  return Response.json({ ref, task, acnError });
});
