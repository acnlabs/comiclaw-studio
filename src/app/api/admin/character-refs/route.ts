import { withAgentAuth } from "@/lib/api";
import { badRequest } from "@/lib/auth";
import {
  planRetirement,
  retireConfigured,
  runRetirement,
} from "@/lib/characterRefRetire";

/**
 * One-time cleanup of registry entries still keyed by a character's own id
 * (`STUDIO_API_KEY`).
 *
 * It lives here rather than in a script because seeing the plan needs the same
 * production credentials as applying it, and nobody should be copying those
 * onto a laptop to find out whether there is anything to clean up.
 *
 * GET = plan (reads only), POST = apply.
 */
export const GET = withAgentAuth(async () => {
  if (!retireConfigured()) {
    return badRequest("AgentPlanet store is not configured on this server");
  }
  const stale = await planRetirement();
  return Response.json({ stale, count: stale.length });
});

export const POST = withAgentAuth(async () => {
  if (!retireConfigured()) {
    return badRequest("AgentPlanet store is not configured on this server");
  }
  const results = await runRetirement();
  return Response.json({
    results,
    retired: results.filter((r) => r.revoked).length,
    failed: results.filter((r) => !r.revoked).length,
  });
});
