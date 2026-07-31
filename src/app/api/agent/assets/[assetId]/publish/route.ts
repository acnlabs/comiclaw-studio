import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, conflict, forbidden, notFoundJson } from "@/lib/auth";
import { mapError, parseBody, withProjectWorkerAuth } from "@/lib/api";
import { productionAgentId, type ProductionAuth } from "@/lib/acnAuth";
import { runPublish, runWithdraw } from "@/lib/assetPublishFlow";
import {
  agentCanPublish,
  checkPublishable,
  resolvePublishOwner,
  PUBLISH_DRAFT,
} from "@/lib/assetPublish";

/**
 * An agent publishes the assets it made.
 *
 * On a co-creation entry every scene and prop is written by an agent, so
 * without this route the work of the people actually filling the column could
 * never reach the registry — and the human column owner cannot stand in for
 * them, because the asset is not theirs.
 */

type Ctx = { params: Promise<{ assetId: string }> };

const publishSchema = z.object({
  /** Pin a specific take; defaults to the newest */
  versionId: z.string().trim().min(1).max(64).optional(),
});

const PUBLISH_ERRORS: Record<string, string> = {
  already_published: "Asset is already published or being published",
  no_versions: "Add artwork before publishing",
  unknown_version: "That version does not belong to this asset",
  unknown_type: "This asset type cannot be published",
};

const getProjectId = async (_req: Request, ctx: Ctx) => {
  const { assetId } = await ctx.params;
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { projectId: true },
  });
  return asset?.projectId ?? null;
};

const actorOf = (auth: ProductionAuth) => {
  const agentId = productionAgentId(auth);
  return agentId ? ({ kind: "agent", agentId } as const) : ({ kind: "studio_key" } as const);
};

const loadAsset = (assetId: string) =>
  prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      type: true,
      name: true,
      publishState: true,
      authorAgentId: true,
      versions: { orderBy: { version: "desc" }, select: { id: true } },
    },
  });

export const POST = withProjectWorkerAuth(
  async (req: Request, ctx: Ctx, auth: ProductionAuth) => {
    let body: z.infer<typeof publishSchema>;
    try {
      body = await parseBody(req, publishSchema);
    } catch (err) {
      return mapError(err);
    }

    const { assetId } = await ctx.params;
    const asset = await loadAsset(assetId);
    if (!asset) return notFoundJson("Asset not found");

    if (!agentCanPublish({ authorAgentId: asset.authorAgentId, actor: actorOf(auth) })) {
      return forbidden("An agent may only publish assets it authored");
    }

    const check = checkPublishable({
      type: asset.type,
      publishState: asset.publishState,
      versionIds: asset.versions.map((v) => v.id),
      requestedVersionId: body.versionId,
    });
    if (!check.ok) {
      const message = PUBLISH_ERRORS[check.reason] ?? "Cannot publish this asset";
      return check.reason === "already_published"
        ? conflict(message)
        : badRequest(message);
    }

    const owner = resolvePublishOwner({
      authorUserId: null,
      authorAgentId: asset.authorAgentId,
      publisherSub: null,
    });
    if (!owner.ok) return badRequest("No owner principal available");

    return runPublish({ asset, owner: owner.owner, versionId: check.versionId });
  },
  { getProjectId, allowPublicContribute: true }
);

export const DELETE = withProjectWorkerAuth(
  async (_req: Request, ctx: Ctx, auth: ProductionAuth) => {
    const { assetId } = await ctx.params;
    const asset = await loadAsset(assetId);
    if (!asset) return notFoundJson("Asset not found");

    if (!agentCanPublish({ authorAgentId: asset.authorAgentId, actor: actorOf(auth) })) {
      return forbidden("An agent may only withdraw assets it authored");
    }
    if (asset.publishState === PUBLISH_DRAFT) {
      return badRequest("Asset is not published");
    }

    return runWithdraw(asset);
  },
  { getProjectId, allowPublicContribute: true }
);
