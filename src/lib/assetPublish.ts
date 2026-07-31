import type { AssetKind, AssetOwner } from "@/lib/assetRegistry";

/**
 * Publishing a project asset: the rules, kept pure so they can be checked
 * without a database or the AgentPlanet Store.
 *
 * A published asset is registered on AgentPlanet and can be licensed by other
 * projects, so it needs three things a draft does not: a pinned version, an
 * ownership principal the registry understands, and a guarantee that it will
 * not disappear underneath a buyer.
 */

export const ASSET_KIND_BY_TYPE: Record<string, AssetKind> = {
  CHARACTER: "character",
  SCENE: "scene",
  PROP: "prop",
};

export function assetKindFor(type: string): AssetKind | null {
  return ASSET_KIND_BY_TYPE[type] ?? null;
}

export type OwnerResolution =
  | { ok: true; owner: AssetOwner }
  | { ok: false; reason: "no_principal" };

/**
 * Who owns a newly published asset.
 *
 * Per the registration matrix: assets under a column that is bound to an ACN
 * Org belong to that Org, so licensing revenue lands in the Org treasury.
 * Otherwise the human publisher holds it as `user` and can hand it to an agent
 * later via change-owner.
 */
export function resolvePublishOwner(args: {
  columnAcnOrgId: string | null;
  publisherSub: string | null;
}): OwnerResolution {
  const orgId = args.columnAcnOrgId?.trim();
  if (orgId) return { ok: true, owner: { type: "org", id: orgId } };

  const sub = args.publisherSub?.trim();
  if (sub) return { ok: true, owner: { type: "user", id: sub } };

  return { ok: false, reason: "no_principal" };
}

export type PublishCheck =
  | { ok: true; versionId: string }
  | {
      ok: false;
      reason: "unknown_type" | "no_versions" | "unknown_version" | "already_published";
    };

/**
 * Validate a publish request. The pinned version must belong to this asset —
 * publishing someone else's artwork by id would otherwise be possible.
 */
export function checkPublishable(args: {
  type: string;
  publishedAt: Date | null;
  versionIds: string[];
  requestedVersionId?: string | null;
}): PublishCheck {
  if (args.publishedAt) return { ok: false, reason: "already_published" };
  if (!assetKindFor(args.type)) return { ok: false, reason: "unknown_type" };
  if (args.versionIds.length === 0) return { ok: false, reason: "no_versions" };

  const requested = args.requestedVersionId?.trim();
  if (!requested) {
    // Default to the newest version, which callers pass first.
    return { ok: true, versionId: args.versionIds[0] };
  }
  if (!args.versionIds.includes(requested)) {
    return { ok: false, reason: "unknown_version" };
  }
  return { ok: true, versionId: requested };
}

/**
 * Deleting a project would cascade its assets away, breaking licences held by
 * other projects, so ops must retire the registration first.
 */
export function blocksProjectDelete(publishedAssetCount: number): boolean {
  return publishedAssetCount > 0;
}
