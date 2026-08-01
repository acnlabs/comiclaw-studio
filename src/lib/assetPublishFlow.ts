import { prisma } from "@/lib/db";
import { conflict } from "@/lib/auth";
import {
  changeAssetOwner,
  registerAsset,
  revokeAsset,
  unlistAssetListing,
} from "@/lib/agentplanet";
import { syncAssetListing, saveListing } from "@/lib/assetListing";
import type { AssetOwner } from "@/lib/assetRegistry";
import {
  assetKindFor,
  PUBLISHED,
  PUBLISH_DRAFT,
  PUBLISH_IN_FLIGHT,
  UNPUBLISH_IN_FLIGHT,
} from "@/lib/assetPublish";

/**
 * The two-system half of publishing, shared by the human and agent entry
 * points. Both routes decide *who may act*; this decides *what happens*, so a
 * fix to the local/registry handshake cannot land in one path and miss the
 * other.
 */

type PublishTarget = {
  id: string;
  type: string;
  name: string;
  storeProductId?: string | null;
  ownerId?: string | null;
};

const registryUnavailable = () =>
  Response.json(
    { error: "Asset registry is unavailable, try again later" },
    { status: 503 }
  );

/**
 * draft → publishing → published.
 *
 * Claiming `publishing` before touching AgentPlanet is what stops a concurrent
 * delete or unpublish from acting on an asset whose registration is still being
 * created, and undoing that claim is a local write rather than a remote call
 * that may fail.
 */
export async function runPublish(args: {
  asset: PublishTarget;
  owner: AssetOwner;
  versionId: string;
}): Promise<Response> {
  const { asset, owner, versionId } = args;

  const kind = assetKindFor(asset.type);
  if (!kind) {
    return Response.json(
      { error: "This asset type cannot be published" },
      { status: 400 }
    );
  }

  const claimed = await prisma.asset.updateMany({
    where: { id: asset.id, publishState: PUBLISH_DRAFT },
    data: {
      publishState: PUBLISH_IN_FLIGHT,
      ownerType: owner.type,
      ownerId: owner.id,
      publishedVersionId: versionId,
    },
  });
  if (claimed.count === 0) {
    return conflict("Asset was published or removed while this request ran");
  }

  // Only release the claim we made: another request may have moved the row on.
  const releaseClaim = () =>
    prisma.asset
      .updateMany({
        where: { id: asset.id, publishState: PUBLISH_IN_FLIGHT },
        data: {
          publishState: PUBLISH_DRAFT,
          ownerType: null,
          ownerId: null,
          publishedVersionId: null,
        },
      })
      .catch((err) =>
        console.error("[asset/publish] failed to release claim", asset.id, err)
      );

  const registered = await registerAsset({
    kind,
    localId: asset.id,
    owner,
    displayName: asset.name,
  });
  if (registered === "failed") {
    await releaseClaim();
    return registryUnavailable();
  }

  // Registered earlier under a different principal (e.g. a retried publish
  // after ownership moved) — realign so a later listing is not rejected.
  if (registered === "exists") {
    const realigned = await changeAssetOwner(kind, asset.id, owner);
    if (!realigned) {
      await releaseClaim();
      return Response.json(
        {
          error:
            "Asset is registered to a different owner and could not be reassigned; try again later",
        },
        { status: 503 }
      );
    }
  }

  const settled = await prisma.asset.updateMany({
    where: { id: asset.id, publishState: PUBLISH_IN_FLIGHT },
    data: { publishState: PUBLISHED, publishedAt: new Date() },
  });
  if (settled.count === 0) {
    // The row moved on under us; the registration stands and a retry realigns
    // it, so do not revoke something another request may now depend on.
    console.error("[asset/publish] claim lost before settling", asset.id);
    return conflict("Asset changed while this request ran");
  }

  const updated = await prisma.asset.findUniqueOrThrow({
    where: { id: asset.id },
    select: LISTED_ASSET,
  });

  // A price set while the asset was a draft only reaches the Store now: it had
  // nothing to be listed under before it was registered.
  const sync = await syncAssetListing(updated);
  await saveListing(asset.id, sync);

  return Response.json(
    {
      asset: { ...updated, storeProductId: sync.storeProductId },
      ...(sync.blocked ? { listingBlocked: true, listingError: LISTING_BLOCKED } : {}),
    },
    { status: 201 }
  );
}

/** Everything the Store sync needs, plus what clients render. */
export const LISTED_ASSET = {
  id: true,
  character: { select: { id: true } },
  name: true,
  description: true,
  type: true,
  ownerType: true,
  ownerId: true,
  publishedVersionId: true,
  publishedAt: true,
  publishState: true,
  licensePoints: true,
  storeProductId: true,
} as const;

export const LISTING_BLOCKED =
  "Published, but not on sale: the asset registry did not back the listing. Try again later.";

/**
 * published → unpublishing → draft, so an in-flight publish is never revoked
 * out from under itself and the local row only clears once AgentPlanet has
 * actually released the registration.
 */
export async function runWithdraw(asset: PublishTarget): Promise<Response> {
  const claimed = await prisma.asset.updateMany({
    where: { id: asset.id, publishState: PUBLISHED },
    data: { publishState: UNPUBLISH_IN_FLIGHT },
  });
  if (claimed.count === 0) {
    return conflict("Asset is busy, try again in a moment");
  }

  // Take the product down before the registration goes: a live product whose
  // registration was revoked is still buyable, and the order would land on an
  // asset nobody can deliver.
  if (asset.storeProductId && asset.ownerId) {
    await unlistAssetListing(asset.storeProductId, asset.ownerId);
  }

  const kind = assetKindFor(asset.type);
  const revoked = kind ? await revokeAsset(kind, asset.id) : true;
  if (!revoked) {
    // Put it back: clearing locally while the registry still holds it would
    // let the project be deleted and strand a real orphan registration.
    await prisma.asset.updateMany({
      where: { id: asset.id, publishState: UNPUBLISH_IN_FLIGHT },
      data: { publishState: PUBLISHED },
    });
    return registryUnavailable();
  }

  await prisma.asset.updateMany({
    where: { id: asset.id, publishState: UNPUBLISH_IN_FLIGHT },
    data: {
      publishState: PUBLISH_DRAFT,
      ownerType: null,
      ownerId: null,
      publishedVersionId: null,
      publishedAt: null,
      storeProductId: null,
    },
  });

  return Response.json({ unpublished: true });
}
