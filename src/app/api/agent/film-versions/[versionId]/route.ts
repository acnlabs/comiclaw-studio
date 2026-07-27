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
  const fv = await prisma.filmVersion.findUnique({
    where: { id: versionId },
    select: { projectId: true },
  });
  return fv?.projectId ?? null;
};

export const DELETE = withProjectWorkerAuth(
  async (_req, ctx: Ctx, auth: ProductionAuth) => {
    const { versionId } = await ctx.params;
    const fv = await prisma.filmVersion.findUnique({
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
    if (!fv) return notFoundJson();

    const denied = assertCanDeleteContent(fv, fv.project, actorFromProductionAuth(auth));
    if (denied) return denied;

    await prisma.filmVersion.delete({ where: { id: versionId } });
    emitProjectUpdate(fv.projectId, "film.deleted");
    return Response.json({ deleted: true });
  },
  { getProjectId }
);
