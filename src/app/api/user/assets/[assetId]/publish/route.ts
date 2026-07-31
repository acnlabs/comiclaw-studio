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
} from "@/lib/assetPublish";

type Ctx = { params: Promise<{ assetId: string }> };

const publishSchema = z.object({
  /** Pin a specific take; defaults to the newest */
  versionId: z.string().trim().min(1).max(64).optional(),
});

const PUBLISH_ERRORS: Record<string, string> = {
  already_published: "Asset is already published",
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
      publishedAt: true,
      ownerType: true,
      ownerId: true,
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

/** Publish a project asset as a tradable, registered asset. */
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

  if (!canPublishAsAuthor({ ...asset, publisherSub: sub })) {
    return forbidden(
      "Only the asset's author can publish it; contributors keep their own work"
    );
  }

  const check = checkPublishable({
    type: asset.type,
    publishedAt: asset.publishedAt,
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

  // Register before marking it published locally: if the registry rejects it,
  // the asset stays a draft rather than claiming an ownership we never got.
  const registered = await registerAsset({
    kind,
    localId: asset.id,
    owner: owner.owner,
    displayName: asset.name,
  });
  if (registered === "failed") {
    return Response.json(
      { error: "Asset registry is unavailable, try again later" },
      { status: 503 }
    );
  }
  // Registered earlier under a different principal (e.g. a retried publish
  // after ownership moved) — realign so a later listing is not rejected.
  if (registered === "exists") {
    const realigned = await changeAssetOwner(kind, asset.id, owner.owner, "publish");
    if (!realigned) {
      return Response.json(
        {
          error:
            "Asset is registered to a different owner and could not be reassigned; try again later",
        },
        { status: 503 }
      );
    }
  }

  try {
    const updated = await prisma.asset.update({
      where: { id: asset.id },
      data: {
        ownerType: owner.owner.type,
        ownerId: owner.owner.id,
        publishedVersionId: check.versionId,
        publishedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        type: true,
        ownerType: true,
        ownerId: true,
        publishedVersionId: true,
        publishedAt: true,
      },
    });
    return Response.json({ asset: updated }, { status: 201 });
  } catch (err) {
    // Do not leave a registration pointing at an asset we failed to mark.
    // If this revoke also fails the ref stays registered, which a retry heals:
    // register returns "exists" and ownership is realigned before publishing.
    const revoked = await revokeAsset(kind, asset.id);
    if (!revoked) {
      console.error("[asset/publish] rollback revoke failed", asset.id);
    }
    return mapError(err);
  }
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

  if (!asset.publishedAt) return badRequest("Asset is not published");

  const kind = assetKindFor(asset.type);
  if (kind) {
    const revoked = await revokeAsset(kind, asset.id);
    // Clearing locally while the registry still holds it would let the project
    // be deleted and strand a real orphan registration.
    if (!revoked) {
      return Response.json(
        { error: "Asset registry is unavailable, try again later" },
        { status: 503 }
      );
    }
  }

  await prisma.asset.update({
    where: { id: asset.id },
    data: {
      ownerType: null,
      ownerId: null,
      publishedVersionId: null,
      publishedAt: null,
    },
  });

  return Response.json({ unpublished: true });
}
