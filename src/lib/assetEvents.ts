/**
 * A PRIVATE project is rendered from client-side state, where router.refresh()
 * cannot reach the fetch that produced it, so ownership changes announce
 * themselves. Kept apart from the controls that fire it: publish renders
 * transfer, and transfer needs the same name.
 */
export const ASSET_PUBLISH_CHANGED_EVENT = "asset-publish:changed";
