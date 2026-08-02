/**
 * Apply pending migrations only on a production deploy.
 *
 * Preview deploys build with the same command as production, so when they also
 * ran `prisma migrate deploy` every branch reshaped the live database the
 * moment it was pushed — before review, before merge. Additive columns survive
 * that, but one dropped column or added NOT NULL would take production down
 * while the pull request was still open.
 *
 * Skipping on preview means a branch that adds a migration will fail on its
 * own preview until it merges. That is the intended trade: a broken preview is
 * a branch's problem, a broken production is everyone's.
 */
import { spawnSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

// Absent VERCEL_ENV means this is not a Vercel build (local, CI) — the caller
// asked for migrations, so run them.
if (env && env !== "production") {
  console.log(
    `[migrate] VERCEL_ENV=${env}: skipping migrate deploy so a preview build cannot reshape the production database.`
  );
  process.exit(0);
}

console.log(`[migrate] VERCEL_ENV=${env ?? "(unset)"}: applying pending migrations.`);
const run = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });
process.exit(run.status ?? 1);
