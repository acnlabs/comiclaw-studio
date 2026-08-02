/**
 * Apply pending migrations, but never to a database this deployment shares
 * with production.
 *
 * Preview deploys build with the same command as production, so while Preview
 * held production's `DATABASE_URL`, running `prisma migrate deploy` meant every
 * branch reshaped the live database the moment it was pushed — before review,
 * before merge. Additive columns survive that; one dropped column would take
 * production down while the pull request was still open.
 *
 * Once Preview points at a shadow database of its own it should migrate again,
 * otherwise every schema change breaks its own preview until someone remembers
 * to migrate the shadow by hand. The same flag that lets a preview write also
 * lets it migrate: `PREVIEW_DATABASE_IS_SHADOW=1`.
 */
import { spawnSync } from "node:child_process";

const env = process.env.VERCEL_ENV;
const shadowFlag = (process.env.PREVIEW_DATABASE_IS_SHADOW ?? "").trim().toLowerCase();
const hasOwnDatabase = shadowFlag === "1" || shadowFlag === "true";

// Absent VERCEL_ENV means this is not a Vercel build (local, CI) — the caller
// asked for migrations, so run them.
const sharesProductionDatabase = Boolean(env) && env !== "production" && !hasOwnDatabase;

if (sharesProductionDatabase) {
  console.log(
    `[migrate] VERCEL_ENV=${env} without PREVIEW_DATABASE_IS_SHADOW: skipping migrate deploy ` +
      `so this build cannot reshape the production database.`
  );
  process.exit(0);
}

const why =
  env && env !== "production"
    ? `VERCEL_ENV=${env} with its own shadow database`
    : `VERCEL_ENV=${env ?? "(unset)"}`;
console.log(`[migrate] ${why}: applying pending migrations.`);
const run = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });
process.exit(run.status ?? 1);
