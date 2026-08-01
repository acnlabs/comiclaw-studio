import { prisma } from "@/lib/db";
import { badRequest, conflict, forbidden } from "@/lib/auth";
import { changeAssetOwner } from "@/lib/agentplanet";
import { assetKindFor, PUBLISHED } from "@/lib/assetPublish";
import { saveListing, syncAssetListing } from "@/lib/assetListing";
import { LISTED_ASSET } from "@/lib/assetPublishFlow";
import type { TransferCheck, TransferRefusal } from "@/lib/assetTransfer";
import type { AssetOwner } from "@/lib/assetRegistry";

/**
 * The two-system half of a transfer, shared by the human and agent routes.
 *
 * AgentPlanet moves first. If the local row went first and the registry call
 * failed, Studio would claim an ownership the registry disagrees with and the
 * next listing attempt would be rejected for a seller/owner mismatch with
 * nothing to point at. Registry-first can only leave the registry ahead, and
 * retrying the same transfer is idempotent.
 */

const REFUSALS: Record<TransferRefusal, { status: number; message: string }> = {
  not_published: {
    status: 400,
    message: "Publish the asset before transferring it",
  },
  no_owner: {
    status: 409,
    message: "This asset has no recorded owner; withdraw and publish it again",
  },
  not_owner: { status: 403, message: "Only the asset's owner can transfer it" },
  not_entitled_to_target: {
    status: 403,
    message: "You cannot transfer assets into that Org",
  },
  same_owner: { status: 400, message: "The asset is already held by that owner" },
};

export function refuseTransfer(reason: TransferRefusal): Response {
  const { status, message } = REFUSALS[reason];
  if (status === 403) return forbidden(message);
  if (status === 409) return conflict(message);
  return badRequest(message);
}

export async function runTransfer(args: {
  asset: { id: string; type: string };
  move: Extract<TransferCheck, { ok: true }>;
}): Promise<Response> {
  const { asset } = args;
  const { from, to } = args.move;

  const kind = assetKindFor(asset.type);
  if (!kind) return badRequest("This asset type cannot be transferred");

  // `rebind`, not a descriptive word: the registry's reason vocabulary is
  // closed, and a free handover between principals is exactly a rebind. Paid
  // handovers are not ours to record — they run inside AgentPlanet's order flow.
  const reassigned = await changeAssetOwner(kind, asset.id, to);
  if (!reassigned) {
    return Response.json(
      { error: "Asset registry is unavailable, try again later" },
      { status: 503 }
    );
  }

  // Conditional on the owner we checked against: a concurrent transfer must not
  // be overwritten by this one's stale idea of where the asset started.
  const updated = await prisma.asset.updateMany({
    where: {
      id: asset.id,
      publishState: PUBLISHED,
      ownerType: from.type,
      ownerId: from.id,
    },
    data: { ownerType: to.type, ownerId: to.id },
  });
  if (updated.count === 0) {
    // The registry already moved, so say so plainly rather than reporting a
    // failure that did in fact happen remotely.
    console.error("[asset/transfer] local row moved under us", asset.id, to);
    return conflict(
      "The asset changed hands while this request ran; the registry now holds the newer owner"
    );
  }

  // A Store product's seller is fixed, so a sold-through asset has to be
  // relisted under its new owner. Skipping this would keep paying the previous
  // one for licences of an asset they no longer hold.
  const moved = await prisma.asset.findUniqueOrThrow({
    where: { id: asset.id },
    select: LISTED_ASSET,
  });
  const sync = await syncAssetListing(moved, { type: from.type, id: from.id });
  await saveListing(asset.id, sync);

  return Response.json({
    transferred: true,
    owner: ownerJson(to),
    ...(sync.blocked
      ? {
          listingBlocked: true,
          listingError:
            "Ownership moved, but the asset is no longer on sale: relisting under the new owner failed. Set the price again to retry.",
        }
      : {}),
  });
}

const ownerJson = (o: AssetOwner) => ({ ownerType: o.type, ownerId: o.id });
