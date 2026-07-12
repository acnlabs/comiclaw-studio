// Runs once per server cold start — applies pending Prisma migrations
// so deployments are self-migrating without needing DATABASE_URL at build time.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { execFileSync } = await import("child_process");
  const { resolve } = await import("path");

  // Use the bundled prisma binary instead of npx (npx may not be in PATH on serverless)
  const prismaBin = resolve(process.cwd(), "node_modules", ".bin", "prisma");

  try {
    execFileSync(prismaBin, ["migrate", "deploy"], {
      stdio: "inherit",
      env: { ...process.env },
    });
  } catch (err) {
    console.error("[instrumentation] prisma migrate deploy failed:", err);
  }
}
