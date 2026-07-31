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
import { registerAsset, changeAssetOwner, revokeAsset } from "@/lib/agentplanet";
import {
  assetKindFor,
  canPublishAsAuthor,
  checkPublishable,
  resolvePublishOwner,
  PUBLISHED,
  PUBLISH_DRAFT,
  PUBLISH_IN_FLIGHT,
  UNPUBLISH_IN_FLIGHT,
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

const registryUnavailable = () =>
  Response.json(
    { error: "Asset registry is unavailable, try again later" },
    { status: 503 }
  );

async function loadOwnedAsset(assetId: string, sub: string) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      type: true,
      name: true,
      publishState: true,
      authorUserId: true,
      authorAgentId: true,
      authorKey: true,
      versions: {
        orderBy: { version: "desc" },
        select: { id: true },
      },
      project: {
        select: {
          ownerUserId: true,
          visibility: true,
          acnOrgId: true,
          column: { select: { acnOrgId: true } },
        },
      },
    },
  });
  if (!asset) return { error: notFoundJson("Asset not found") } as const;
  if (!asset.project?.ownerUserId || asset.project.ownerUserId !== sub) {
    return { error: forbidden("You do not own this asset's project") } as const;
  }
  return { asset } as const;
}

/**
 * Publish a project asset as a tradable, registered asset.
 *
 * The local row moves draft → publishing → published. Claiming `publishing`
 * before touching AgentPlanet is what stops a concurrent delete or unpublish
 * from acting on an asset whose registration is still being created, and
 * undoing that claim is a local write rather than a remote call that may fail.
 */
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

  // A project may override its column's Org, so prefer the project binding.
  const owner = resolvePublishOwner({
    columnAcnOrgId:
      asset.project.acnOrgId ?? asset.project.column?.acnOrgId ?? null,
    publisherSub: sub,
  });
  if (!owner.ok) return badRequest("No owner principal available");

  const kind = assetKindFor(asset.type);
  if (!kind) return badRequest("This asset type cannot be published");

  const claimed = await prisma.asset.updateMany({
    where: { id: asset.id, publishState: PUBLISH_DRAFT },
    data: {
      publishState: PUBLISH_IN_FLIGHT,
      ownerType: owner.owner.type,
      ownerId: owner.owner.id,
      publishedVersionId: check.versionId,
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
    owner: owner.owner,
    displayName: asset.name,
  });
  if (registered === "failed") {
    await releaseClaim();
    return registryUnavailable();
  }

  // Registered earlier under a different principal (e.g. a retried publish
  // after ownership moved) — realign so a later listing is not rejected.
  if (registered === "exists") {
    const realigned = await changeAssetOwner(kind, asset.id, owner.owner, "publish");
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

  const updated = await prisma.asset.findUnique({
    where: { id: asset.id },
    select: {
      id: true,
      name: true,
      type: true,
      ownerType: true,
      ownerId: true,
      publishedVersionId: true,
      publishedAt: true,
      publishState: true,
    },
  });
  return Response.json({ asset: updated }, { status: 201 });
}

/**
 * Withdraw a published asset from the registry.
 * published → unpublishing → draft, so an in-flight publish is never revoked
 * out from under itself and the local row only clears once AgentPlanet has
 * actually released the registration.
 */
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

  const claimed = await prisma.asset.updateMany({
    where: { id: asset.id, publishState: PUBLISHED },
    data: { publishState: UNPUBLISH_IN_FLIGHT },
  });
  if (claimed.count === 0) {
    return conflict("Asset is busy, try again in a moment");
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
    },
  });

  return Response.json({ unpublished: true });
}
