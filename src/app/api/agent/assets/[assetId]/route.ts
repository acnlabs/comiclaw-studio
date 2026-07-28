import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withProjectWorkerAuth } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import {
  actorFromProductionAuth,
  assertCanDeleteContent,
} from "@/lib/contentAuth";
import type { ProductionAuth } from "@/lib/acnAuth";

type Ctx = { params: Promise<{ assetId: string }> };

const getProjectId = async (_req: Request, ctx: Ctx) => {
  const { assetId } = await ctx.params;
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { projectId: true },
  });
  return asset?.projectId ?? null;
};

export const DELETE = withProjectWorkerAuth(
  async (_req, ctx: Ctx, auth: ProductionAuth) => {
    const { assetId } = await ctx.params;
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        projectId: true,
        authorUserId: true,
        authorAgentId: true,
        authorKey: true,
        project: { select: { ownerUserId: true, visibility: true } },
      },
    });
    if (!asset) return notFoundJson();

    const denied = assertCanDeleteContent(
      asset,
      asset.project,
      actorFromProductionAuth(auth)
    );
    if (denied) return denied;

    await prisma.asset.delete({ where: { id: assetId } });
    emitProjectUpdate(asset.projectId, "asset.deleted");
    return Response.json({ deleted: true });
  },
  { getProjectId, allowPublicContribute: true }
);
