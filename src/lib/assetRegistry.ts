/**
 * AgentPlanet asset registry client (platform-level ownership ledger).
 *
 * Per the ComicLaw × AgentPlanet registration matrix:
 * - `asset_kind` ∈ character | scene | prop
 * - `owner_type` ∈ user | agent | org (there is no `human`; people are `user`)
 * - org ids are ACN org ids (`org_{uuid}`)
 * - a Store listing's seller MUST equal the registry owner, or listing 403s
 * - ownership and on-screen identity are separate: change the acting agent with
 *   PATCH `bound_agent_id`, change ownership with change-owner
 */

/**
 * Canonical paths. The registry graduated from `/api/store/asset-registry` to
 * `/api/assets/registry`, and Store products from `/api/store/agent-assets` to
 * `/api/store/assets`; the old ones remain as compat aliases, so keeping the
 * paths in one place is what stops new code drifting back to them.
 *
 * Both hosts answer 401 (not 404) on these paths, i.e. the routes are live on
 * the AgentPlanet backend and on the CN backend — not on the ACN backend.
 */
export const REGISTRY_PATH = "/api/assets/registry";
export const STORE_PRODUCTS_PATH = "/api/store/assets/products";

export function registryEntryPath(ref: string): string {
  return `${REGISTRY_PATH}/${encodeURIComponent(ref)}`;
}

export function registryActionPath(
  ref: string,
  action: "change-owner" | "revoke"
): string {
  return `${registryEntryPath(ref)}/${action}`;
}

export function storeProductPath(productId: string, action?: "unlist" | "order"): string {
  const base = `${STORE_PRODUCTS_PATH}/${productId}`;
  return action ? `${base}/${action}` : base;
}

export type AssetKind = "character" | "scene" | "prop";

export type AssetOwner =
  | { type: "user"; id: string }
  | { type: "agent"; id: string }
  | { type: "org"; id: string };

export const ASSET_SOURCE = "comiclaw-studio";

/**
 * Reasons the registry accepts on change-owner.
 *
 * The vocabulary is closed on AgentPlanet's side and `sale` is explicitly
 * refused: a paid handover has to run inside their order flow, which holds the
 * row lock, ties the move to an order id and can roll it back on refund.
 * Inventing a descriptive reason here (`"transfer"`, `"listing"`, …) reads
 * fine and gets the call rejected, which our fail-closed callers turn into a
 * user-visible 503.
 */
export const CHANGE_OWNER_REASONS = ["rebind", "admin"] as const;
export type ChangeOwnerReason = (typeof CHANGE_OWNER_REASONS)[number];

export function isChangeOwnerReason(value: string): value is ChangeOwnerReason {
  return (CHANGE_OWNER_REASONS as readonly string[]).includes(value);
}

/** Namespace is derived from the source's first segment and must stay in sync. */
export function assetRef(kind: AssetKind, localId: string): string {
  return `comiclaw:${kind}:${localId}`;
}

export type RegisterResult = "registered" | "exists" | "failed";

export type RegisterAssetArgs = {
  kind: AssetKind;
  /** Stable ComicLaw primary key — never a display name */
  localId: string;
  owner: AssetOwner;
  displayName: string;
  /**
   * Agent that appears as this asset on screen. Independent of ownership:
   * an org-owned character is still played by a member agent. Scenes and
   * props normally leave this null.
   */
  boundAgentId?: string | null;
};

export function registerAssetPayload(args: RegisterAssetArgs) {
  return {
    asset_ref: assetRef(args.kind, args.localId),
    source: ASSET_SOURCE,
    asset_kind: args.kind,
    owner_type: args.owner.type,
    owner_id: args.owner.id,
    display_name: args.displayName,
    bound_agent_id: args.boundAgentId ?? null,
  };
}

/** Store rejects a listing whose seller differs from the registered owner. */
export function sellerMatchesOwner(
  seller: { type: string; id: string },
  owner: AssetOwner
): boolean {
  return seller.type === owner.type && seller.id === owner.id;
}

/**
 * Whether a listing may proceed after touching the registry.
 *
 * `store_asset_registry_enforce` is on in both the global and CN environments,
 * so an unregistered asset cannot be listed, relisted or ordered. Listing
 * anyway would leave the owner believing a price took effect on something
 * nobody can buy, so anything short of a confirmed registration stops here.
 */
export function mayListAfterRegistration(args: {
  registration: RegisterResult;
  ownerRealigned: boolean;
}): boolean {
  if (args.registration === "failed") return false;
  if (args.registration === "exists") return args.ownerRealigned;
  return true;
}
