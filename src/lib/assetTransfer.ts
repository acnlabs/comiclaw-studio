import type { AssetOwner } from "@/lib/assetRegistry";
import { PUBLISHED } from "@/lib/assetPublish";

/**
 * Handing a published asset to an Org — and taking it back.
 *
 * Publishing gives the asset to whoever made it. Moving it into an Org is the
 * explicit act that ownership-follows-author deliberately leaves out of
 * publishing, so it needs its own rules: who may give, who may take back, and
 * which Orgs a principal is entitled to move assets through.
 */

export type TransferTarget = { kind: "org"; orgId: string } | { kind: "self" };

/**
 * Entitlement is split because being *in* an Org and *governing* it are
 * different things. A member agent may contribute an asset to its Org; letting
 * that same membership pull assets back out would let any member walk off with
 * the Org's property.
 */
export type OrgEntitlement = {
  /** Orgs the actor may hand an asset to. */
  putInto: string[];
  /** Orgs the actor may take an asset out of. */
  takeFrom: string[];
};

export type TransferRefusal =
  | "not_published"
  | "no_owner"
  | "not_owner"
  | "not_entitled_to_target"
  | "same_owner";

export type TransferCheck =
  | { ok: true; from: AssetOwner; to: AssetOwner }
  | { ok: false; reason: TransferRefusal };

const isOwnerType = (v: string | null): v is AssetOwner["type"] =>
  v === "user" || v === "agent" || v === "org";

/**
 * Whether a principal may act for the asset's owner — hand it on, or price it.
 * An Org's assets answer to whoever governs the Org, not to its members.
 */
export function controlsAsset(args: {
  owner: AssetOwner;
  actor: { type: "user" | "agent"; id: string };
  governs: string[];
}): boolean {
  if (args.owner.type === args.actor.type && args.owner.id === args.actor.id) {
    return true;
  }
  return args.owner.type === "org" && args.governs.includes(args.owner.id);
}

export function checkTransfer(args: {
  asset: { publishState: string; ownerType: string | null; ownerId: string | null };
  actor: { type: "user" | "agent"; id: string };
  entitlement: OrgEntitlement;
  target: TransferTarget;
}): TransferCheck {
  // Ownership only exists once the asset is registered; a draft belongs to its
  // author implicitly and has nothing to move.
  if (args.asset.publishState !== PUBLISHED) {
    return { ok: false, reason: "not_published" };
  }
  if (!isOwnerType(args.asset.ownerType) || !args.asset.ownerId?.trim()) {
    return { ok: false, reason: "no_owner" };
  }

  const from: AssetOwner = {
    type: args.asset.ownerType,
    id: args.asset.ownerId.trim(),
  };

  if (!controlsAsset({ owner: from, actor: args.actor, governs: args.entitlement.takeFrom })) {
    return { ok: false, reason: "not_owner" };
  }

  const to: AssetOwner =
    args.target.kind === "org"
      ? { type: "org", id: args.target.orgId.trim() }
      : { type: args.actor.type, id: args.actor.id };

  if (to.type === "org" && !args.entitlement.putInto.includes(to.id)) {
    return { ok: false, reason: "not_entitled_to_target" };
  }
  if (to.type === from.type && to.id === from.id) {
    return { ok: false, reason: "same_owner" };
  }

  return { ok: true, from, to };
}
