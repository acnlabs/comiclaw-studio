import { checkApiKey, unauthorized } from "@/lib/auth";
import {
  planCharacterRefMigration,
  runCharacterRefMigration,
} from "@/lib/characterRefMigration";

/**
 * One-off endpoint for the character registry cutover, same shape as
 * `/api/admin/migrate`: `STUDIO_API_KEY` as a bearer, one curl, no session.
 *
 * It runs here rather than from a laptop because the credentials it needs —
 * the production database and the AgentPlanet internal token — are already on
 * the server, and copying them out to run a script is both extra work and
 * extra exposure. It is not a page: this moves one row, once.
 *
 * GET is a read-only probe of the live registry; POST does the move and can be
 * called again to resume anything left half-finished.
 */
export async function GET(req: Request) {
  if (!checkApiKey(req)) return unauthorized();
  return Response.json(await planCharacterRefMigration());
}

export async function POST(req: Request) {
  if (!checkApiKey(req)) return unauthorized();
  const results = await runCharacterRefMigration();
  return Response.json({
    results,
    moved: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  });
}
