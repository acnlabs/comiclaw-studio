import { notFoundJson } from "@/lib/auth";

/**
 * Honest 404s for API paths that match nothing.
 *
 * On Vercel a non-GET request to an unmatched path renders the HTML not-found
 * page with **200** (`x-matched-path: /_not-found`); a local production build
 * returns 404 for the same request. A caller that posts to a typo'd or retired
 * endpoint therefore sees a successful HTML response, passes its `res.ok`
 * check, and fails later on JSON parsing — the one thing it should have been
 * told plainly is the one thing it does not learn.
 *
 * Specific routes win over a catch-all, so this only answers what nothing else
 * claimed.
 */
const gone = () => notFoundJson("No such API route");

export const GET = gone;
export const POST = gone;
export const PUT = gone;
export const PATCH = gone;
export const DELETE = gone;
export const HEAD = gone;
