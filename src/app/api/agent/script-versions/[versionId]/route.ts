import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withProjectWorkerAuth } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import {
  actorFromProductionAuth,
  assertCanDeleteContent,
} from "@/lib/contentAuth";
import type { ProductionAuth } from "@/lib/acnAuth";

type Ctx = { params: Promise<{ versionId: string }> };

const getProjectId = async (_req: Request, ctx: Ctx) => {
  const { versionId } = await ctx.params;
  const sv = await prisma.scriptVersion.findUnique({
    where: { id: versionId },
    select: { projectId: true },
  });
  return sv?.projectId ?? null;
};

export const DELETE = withProjectWorkerAuth(
  async (_req, ctx: Ctx, auth: ProductionAuth) => {
    const { versionId } = await ctx.params;
    const sv = await prisma.scriptVersion.findUnique({
      where: { id: versionId },
      select: {
        id: true,
        projectId: true,
        authorUserId: true,
        authorAgentId: true,
        authorKey: true,
        project: { select: { ownerUserId: true, visibility: true } },
      },
    });
    if (!sv) return notFoundJson();

    const denied = assertCanDeleteContent(sv, sv.project, actorFromProductionAuth(auth));
    if (denied) return denied;

    await prisma.scriptVersion.delete({ where: { id: versionId } });
    emitProjectUpdate(sv.projectId, "script.deleted");
    return Response.json({ deleted: true });
  },
  { getProjectId }
);
