import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withProjectWorkerAuth } from "@/lib/api";
import { conflict, notFoundJson } from "@/lib/auth";
import {
  actorFromProductionAuth,
  assertCanDeleteContent,
} from "@/lib/contentAuth";
import { blocksAssetDelete, deletableState, PUBLISH_DRAFT } from "@/lib/assetPublish";
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
        publishState: true,
        authorUserId: true,
        authorAgentId: true,
        authorKey: true,
        project: { select: { ownerUserId: true, visibility: true } },
      },
    });
    if (!asset) return notFoundJson();

    if (!deletableState(asset.publishState)) {
      return conflict(
        "This asset is registered (or being registered); withdraw it before deleting"
      );
    }

    const denied = assertCanDeleteContent(
      asset,
      asset.project,
      actorFromProductionAuth(auth)
    );
    if (denied) return denied;

    // A published asset is registered on AgentPlanet and may be licensed by
    // other projects. Deleting it here would strand that registration, so the
    // author has to withdraw it first. The state condition lives in the delete
    // itself: a publish landing right after a separate check would otherwise
    // slip through.
    const granted = await prisma.assetLicense.count({
      where: { assetId, status: "GRANTED" },
    });
    if (blocksAssetDelete(granted)) {
      return conflict(
        `This asset is licensed by ${granted} project(s); the licence record must be kept`
      );
    }

    const removed = await prisma.asset.deleteMany({
      where: { id: assetId, publishState: PUBLISH_DRAFT },
    });
    if (removed.count === 0) {
      return conflict(
        "This asset is registered (or being registered); withdraw it before deleting"
      );
    }
    emitProjectUpdate(asset.projectId, "asset.deleted");
    return Response.json({ deleted: true });
  },
  { getProjectId, allowPublicContribute: true }
);
