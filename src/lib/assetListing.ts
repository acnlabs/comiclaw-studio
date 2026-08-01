import { prisma } from "@/lib/db";
import {
  changeAssetOwner,
  getAssetRegistration,
  storeConfigured,
  unlistAssetListing,
  upsertAssetListing,
} from "@/lib/agentplanet";
import { assetKindFor, PUBLISHED } from "@/lib/assetPublish";
import type { AssetOwner } from "@/lib/assetRegistry";

/**
 * Selling usage rights to a project asset on the AgentPlanet Store.
 *
 * The Store requires the seller to be the registry owner, so the listing has to
 * follow ownership: after a transfer the old owner's product would keep taking
 * the money. Every path that changes price, publish state or owner comes
 * through here.
 */

export type ListingOwner = { type: string | null; id: string | null };

export type ListingAction =
  | { kind: "none" }
  | { kind: "list"; owner: AssetOwner }
  /** Seller cannot be changed on a Store product, so a moved asset is relisted. */
  | { kind: "relist"; from: AssetOwner; to: AssetOwner }
  | { kind: "unlist"; seller: AssetOwner }
  /** Listed under an owner we no longer know: nobody can be matched as seller. */
  | { kind: "orphan" };

const owner = (o: ListingOwner): AssetOwner | null =>
  o.type && o.id ? ({ type: o.type as AssetOwner["type"], id: o.id }) : null;

/**
 * What the Store should look like for this asset. Pure so the money-shaped
 * decisions can be checked without a Store.
 */
export function planListing(args: {
  publishState: string;
  licensePoints: number;
  storeProductId: string | null;
  current: ListingOwner;
  /** Owner the existing product was created under, when it differs. */
  listedUnder?: ListingOwner;
}): ListingAction {
  const now = owner(args.current);
  const sellable =
    args.publishState === PUBLISHED && args.licensePoints > 0 && now !== null;

  if (!args.storeProductId) {
    return sellable && now ? { kind: "list", owner: now } : { kind: "none" };
  }

  const before = args.listedUnder ? owner(args.listedUnder) : now;
  if (!before) return { kind: "orphan" };

  if (!sellable) return { kind: "unlist", seller: before };
  if (!now) return { kind: "orphan" };
  if (before.type !== now.type || before.id !== now.id) {
    return { kind: "relist", from: before, to: now };
  }
  return { kind: "list", owner: now };
}

export type ListingSync = {
  storeProductId: string | null;
  /**
   * The asset is priced but not on sale: the registry would not back the
   * listing. Callers must surface this — a seller who thinks their asset is on
   * sale while nobody can buy it is worse than an error.
   */
  blocked: boolean;
};

type SyncTarget = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  publishState: string;
  licensePoints: number;
  storeProductId: string | null;
  ownerType: string | null;
  ownerId: string | null;
};

/**
 * Bring the Store in line with the asset. Returns the product id to persist.
 *
 * Registration is confirmed rather than created: publishing already registered
 * the asset, and a listing whose registration is missing would be refused at
 * order time under `store_asset_registry_enforce`, after the seller had been
 * told everything was fine.
 */
export async function syncAssetListing(
  asset: SyncTarget,
  previousOwner?: ListingOwner
): Promise<ListingSync> {
  const unchanged: ListingSync = {
    storeProductId: asset.storeProductId,
    blocked: false,
  };
  if (!storeConfigured()) return unchanged;

  const kind = assetKindFor(asset.type);
  if (!kind) return unchanged;

  const plan = planListing({
    publishState: asset.publishState,
    licensePoints: asset.licensePoints,
    storeProductId: asset.storeProductId,
    current: { type: asset.ownerType, id: asset.ownerId },
    listedUnder: previousOwner,
  });

  if (plan.kind === "none") return unchanged;

  if (plan.kind === "orphan") {
    // Loud, because it needs a human: the product stays on sale and we cannot
    // name a seller to take it down with.
    console.error(
      "[assetListing] cannot unlist, seller unknown",
      asset.id,
      asset.storeProductId
    );
    return unchanged;
  }

  if (plan.kind === "unlist") {
    if (asset.storeProductId) {
      await unlistAssetListing(asset.storeProductId, plan.seller.id);
    }
    return { storeProductId: null, blocked: false };
  }

  if (plan.kind === "relist" && asset.storeProductId) {
    // The old product must go down under its own seller; the new owner gets a
    // fresh one below.
    await unlistAssetListing(asset.storeProductId, plan.from.id);
  }

  const to = plan.kind === "relist" ? plan.to : plan.owner;

  const registration = await getAssetRegistration(kind, asset.id);
  if (!registration) {
    console.error("[assetListing] not registered, refusing to list", asset.id);
    return { storeProductId: null, blocked: true };
  }
  if (registration.owner_type !== to.type || registration.owner_id !== to.id) {
    const realigned = await changeAssetOwner(kind, asset.id, to);
    if (!realigned) {
      console.error("[assetListing] registry owner mismatch", asset.id, registration);
      return { storeProductId: null, blocked: true };
    }
  }

  const productId = await upsertAssetListing({
    storeProductId: plan.kind === "relist" ? null : asset.storeProductId,
    kind,
    localId: asset.id,
    name: asset.name,
    tagline: asset.description,
    imageUrl: null,
    owner: to,
    credits: asset.licensePoints,
  });
  if (!productId) return { storeProductId: null, blocked: true };
  return { storeProductId: productId, blocked: false };
}

/** Persist whatever the sync settled on, so the two never drift apart. */
export async function saveListing(assetId: string, sync: ListingSync) {
  await prisma.asset.update({
    where: { id: assetId },
    data: { storeProductId: sync.storeProductId },
  });
}
