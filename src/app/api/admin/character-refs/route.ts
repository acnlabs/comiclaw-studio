import { withAdminSession } from "@/lib/adminSession";
import {
  planCharacterRefMigration,
  runCharacterRefMigration,
} from "@/lib/characterRefMigration";

/**
 * Run the character registry cutover from the browser.
 *
 * The credentials this needs — the production database and the AgentPlanet
 * internal token — are already here on the server. Making someone dig them out
 * to run a script from a laptop is both more work and more exposure than
 * clicking a button behind the ops session.
 */

/** What would move. Read-only: probes the live registry, changes nothing. */
export const GET = withAdminSession(async () => {
  return Response.json(await planCharacterRefMigration());
});

/** Do it. Re-runnable, and resumes anything left half-finished. */
export const POST = withAdminSession(async () => {
  const results = await runCharacterRefMigration();
  return Response.json({
    results,
    moved: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  });
});
