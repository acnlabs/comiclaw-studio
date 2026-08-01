import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import {
  badRequest,
  conflict,
  forbidden,
  notFoundJson,
  unauthorized,
} from "@/lib/auth";
import { mapError, parseBody } from "@/lib/api";
import {
  LISTED_ASSET,
  LISTING_BLOCKED,
  runPublish,
  runWithdraw,
} from "@/lib/assetPublishFlow";
import { saveListing, syncAssetListing } from "@/lib/assetListing";
import { controlsAsset } from "@/lib/assetTransfer";
import { governedOrgIds } from "@/lib/orgGovernance";
import {
  canPublishAsAuthor,
  checkPublishable,
  resolvePublishOwner,
  PUBLISH_DRAFT,
  PUBLISHED,
} from "@/lib/assetPublish";

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

async function loadOwnedAsset(assetId: string, sub: string) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      type: true,
      name: true,
      publishState: true,
      storeProductId: true,
      ownerId: true,
      authorUserId: true,
      authorAgentId: true,
      authorKey: true,
      versions: {
        orderBy: { version: "desc" },
        select: { id: true },
      },
      project: { select: { ownerUserId: true, visibility: true } },
    },
  });
  if (!asset) return { error: notFoundJson("Asset not found") } as const;
  if (!asset.project?.ownerUserId || asset.project.ownerUserId !== sub) {
    return { error: forbidden("You do not own this asset's project") } as const;
  }
  return { asset } as const;
}

/** Publish a project asset the caller authored as a tradable, registered asset. */
export async function POST(req: Request, ctx: Ctx) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const { assetId: rawId } = await ctx.params;
  const assetId = rawId?.trim();
  if (!assetId) return notFoundJson();

  let body: z.infer<typeof publishSchema>;
  try {
    body = await parseBody(req, publishSchema);
  } catch (err) {
    return mapError(err);
  }

  const loaded = await loadOwnedAsset(assetId, sub);
  if ("error" in loaded) return loaded.error;
  const { asset } = loaded;

  if (
    !canPublishAsAuthor({
      ...asset,
      projectVisibility: asset.project.visibility,
      publisherSub: sub,
    })
  ) {
    return forbidden(
      "Only the asset's author can publish it; contributors keep their own work"
    );
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

  // Ownership follows the author, not the container it was made in.
  const owner = resolvePublishOwner({
    authorUserId: asset.authorUserId,
    authorAgentId: asset.authorAgentId,
    publisherSub: sub,
  });
  if (!owner.ok) return badRequest("No owner principal available");

  return runPublish({ asset, owner: owner.owner, versionId: check.versionId });
}

/** Withdraw a published asset from the registry. */
export async function DELETE(req: Request, ctx: Ctx) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const { assetId: rawId } = await ctx.params;
  const assetId = rawId?.trim();
  if (!assetId) return notFoundJson();

  const loaded = await loadOwnedAsset(assetId, sub);
  if ("error" in loaded) return loaded.error;
  const { asset } = loaded;

  if (asset.publishState === PUBLISH_DRAFT) {
    return badRequest("Asset is not published");
  }

  return runWithdraw(asset);
}

const priceSchema = z.object({
  /** Credits a licensee pays for usage rights; 0 keeps it free. */
  licensePoints: z.number().int().min(0).max(1_000_000),
});

/** Price the usage rights of an asset you own (or your Org owns). */
export async function PATCH(req: Request, ctx: Ctx) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const { assetId: rawId } = await ctx.params;
  const assetId = rawId?.trim();
  if (!assetId) return notFoundJson();

  let body: z.infer<typeof priceSchema>;
  try {
    body = await parseBody(req, priceSchema);
  } catch (err) {
    return mapError(err);
  }

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: LISTED_ASSET,
  });
  if (!asset) return notFoundJson("Asset not found");
  if (asset.publishState !== PUBLISHED) {
    return badRequest("Publish the asset before pricing it");
  }
  if (!asset.ownerType || !asset.ownerId) {
    return conflict("This asset has no recorded owner");
  }
  const controls = controlsAsset({
    owner: { type: asset.ownerType as "user" | "agent" | "org", id: asset.ownerId },
    actor: { type: "user", id: sub },
    governs: await governedOrgIds(sub),
  });
  if (!controls) return forbidden("Only the asset's owner can price it");

  const priced = await prisma.asset.update({
    where: { id: asset.id },
    data: { licensePoints: body.licensePoints },
    select: LISTED_ASSET,
  });
  const sync = await syncAssetListing(priced);
  await saveListing(asset.id, sync);

  return Response.json({
    asset: { ...priced, storeProductId: sync.storeProductId },
    ...(sync.blocked ? { listingBlocked: true, listingError: LISTING_BLOCKED } : {}),
  });
}
