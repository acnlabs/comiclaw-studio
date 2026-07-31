import { LEGACY_AUTHOR_KEY } from "@/lib/authorKey";
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

const ASSET_KIND_BY_TYPE: Record<string, AssetKind> = {
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
 * Who owns a newly published asset: whoever made it.
 *
 * Deliberately *not* the column's Org. Deriving ownership from the container
 * would take a community creator's scene published under an Org-bound column
 * and hand it to that Org — licensing revenue included. Ownership follows the
 * author, and moving it to an Org stays an explicit act (change-owner), not a
 * side effect of where the work happened to be made.
 *
 * `publisherSub` only covers pre-authorship rows, which `canPublishAsAuthor`
 * already restricts to the project owner's own PRIVATE work.
 */
export function resolvePublishOwner(args: {
  authorUserId: string | null;
  authorAgentId: string | null;
  publisherSub: string | null;
}): OwnerResolution {
  const agentId = args.authorAgentId?.trim();
  if (agentId) return { ok: true, owner: { type: "agent", id: agentId } };

  const authorSub = args.authorUserId?.trim();
  if (authorSub) return { ok: true, owner: { type: "user", id: authorSub } };

  const sub = args.publisherSub?.trim();
  if (sub) return { ok: true, owner: { type: "user", id: sub } };

  return { ok: false, reason: "no_principal" };
}

/**
 * Publishing spans two systems, so the local row carries an explicit state
 * rather than inferring one from `publishedAt`. Without it a concurrent
 * unpublish cannot tell "registration in flight" from "registered", and would
 * revoke a registration that is still being created.
 */
export const PUBLISH_DRAFT = "draft";
export const PUBLISH_IN_FLIGHT = "publishing";
export const PUBLISHED = "published";
export const UNPUBLISH_IN_FLIGHT = "unpublishing";

/** Only a settled draft may be deleted; anything else has a registration to settle. */
export function deletableState(state: string): boolean {
  return state === PUBLISH_DRAFT;
}

/**
 * A withdrawn asset is a draft again and therefore deletable, but its licence
 * rows cascade with it. Those rows are the record that a grant happened — and
 * paid receipts will live in the same table — so a licensed asset stays.
 */
export function blocksAssetDelete(grantedLicenseCount: number): boolean {
  return grantedLicenseCount > 0;
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
  publishState: string;
  versionIds: string[];
  requestedVersionId?: string | null;
}): PublishCheck {
  if (args.publishState !== PUBLISH_DRAFT) {
    return { ok: false, reason: "already_published" };
  }
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
 * other projects, so ops must retire the registration first. In-flight states
 * count too: their registration may already exist on AgentPlanet.
 */
export function blocksProjectDelete(unsettledAssetCount: number): boolean {
  return unsettledAssetCount > 0;
}

/**
 * Publishing claims ownership and opens the asset to licensing, so it is not
 * the project owner's to do on someone else's work. On a PUBLIC co-creation
 * entry the contributors are agents and their assets stay theirs.
 *
 * `legacy` only means "authored before we recorded authorship", not "mine". In
 * a PRIVATE delivery project those rows are the owner's own production work,
 * but on a PUBLIC entry they may be pre-authorship agent contributions, so
 * they are not claimable there.
 */
export function canPublishAsAuthor(args: {
  authorUserId: string | null;
  authorAgentId: string | null;
  authorKey: string;
  projectVisibility: string;
  publisherSub: string;
}): boolean {
  if (args.authorUserId) return args.authorUserId === args.publisherSub;
  if (args.authorAgentId) return false;
  return (
    args.authorKey === LEGACY_AUTHOR_KEY && args.projectVisibility !== "PUBLIC"
  );
}

/**
 * The agent-side counterpart. An agent publishes its own work and nothing
 * else — not even a Studio key stands in for it, because publishing opens the
 * asset to licensing and that is the owner's call to make.
 */
export function agentCanPublish(args: {
  authorAgentId: string | null;
  actor: { kind: "studio_key" } | { kind: "agent"; agentId: string };
}): boolean {
  if (args.actor.kind === "studio_key") return false;
  const author = args.authorAgentId?.trim();
  return Boolean(author) && author === args.actor.agentId.trim();
}
