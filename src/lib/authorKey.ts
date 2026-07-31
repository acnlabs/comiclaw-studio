/**
 * Kept in its own dependency-free module: client components need this constant,
 * and reaching it through contentAuthor.ts would drag `auth.ts` — Node crypto
 * and server env reads — into the browser bundle.
 */
export const LEGACY_AUTHOR_KEY = "legacy";
