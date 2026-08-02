/**
 * Only production may write to systems outside Studio.
 *
 * Vercel gives every deployment the same environment variables unless someone
 * scopes them, so a preview build of any branch holds the production ACN key
 * and the production AgentPlanet token. That is not a hypothetical: a preview
 * URL was observed adding members to the live Org as `comiclaw-studio`.
 *
 * Reads stay open — a preview that cannot read is useless for review, and a
 * read cannot move money or membership. Writes are refused, so the worst a
 * preview can do is show stale truth.
 *
 * Local development and CI have no `VERCEL_ENV`, so they are unaffected; point
 * them at the fakes in `scripts/`.
 */

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isProductionRuntime(): boolean {
  const env = process.env.VERCEL_ENV;
  return !env || env === "production";
}

/**
 * True when this deployment is reading the production database without having
 * been given one of its own. Same trap as the credentials: `DATABASE_URL` is
 * handed to every deployment unless someone scopes it, so a preview of any
 * branch can write live rows.
 *
 * Unlike the API keys, a preview cannot simply be denied a database — it would
 * not run at all. So the switch is explicit: once Preview points at a shadow
 * database, set `PREVIEW_DATABASE_IS_SHADOW=1` there and writes resume.
 */
export function previewDatabaseIsShared(): boolean {
  if (isProductionRuntime()) return false;
  const flag = (process.env.PREVIEW_DATABASE_IS_SHADOW ?? "").trim();
  return flag !== "1" && flag.toLowerCase() !== "true";
}

/**
 * A refusal Response when this deployment must not perform the write, else
 * null. Returning a Response rather than throwing keeps callers on their
 * existing "remote said no" path instead of inventing a new failure mode.
 */
export function refuseExternalWrite(
  system: "acn" | "agentplanet",
  method: string | undefined,
  path: string
): Response | null {
  if (READ_METHODS.has((method ?? "GET").toUpperCase())) return null;
  if (isProductionRuntime()) return null;

  console.warn(
    `[externalWrites] refused ${method} ${path} to ${system} from VERCEL_ENV=${process.env.VERCEL_ENV}`
  );
  return Response.json(
    {
      error: "external_write_blocked",
      message: `Only production deployments may write to ${system}`,
      system,
    },
    { status: 403 }
  );
}
