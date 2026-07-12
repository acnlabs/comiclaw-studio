// Next.js instrumentation: runs once per server cold start.
// Applies any pending Prisma migrations automatically so Vercel deployments
// are self-migrating without needing DATABASE_URL at build time.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { execSync } = await import("child_process");
    try {
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
    } catch (err) {
      // Log but don't crash — the app may still work if the schema is current.
      console.error("[instrumentation] prisma migrate deploy failed:", err);
    }
  }
}
