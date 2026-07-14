import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withAgentAuth, parseBody } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { z } from "zod";

type Ctx = { params: Promise<{ commentId: string }> };

const patchSchema = z.object({ status: z.enum(["OPEN", "RESOLVED"]) });

// agent 标记批注状态(处理完成后置 RESOLVED)
export const PATCH = withAgentAuth(async (req, ctx: Ctx) => {
  const { commentId } = await ctx.params;
  const body = await parseBody(req, patchSchema);

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, projectId: true },
  });
  if (!comment) return notFoundJson();

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { status: body.status },
  });
  emitProjectUpdate(comment.projectId, "comment.updated");
  return Response.json({ comment: updated });
});
