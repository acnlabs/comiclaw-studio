// 启动期环境变量校验(仅在 Node 运行时执行一次)
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const required = ["DATABASE_URL", "STUDIO_API_KEY", "ADMIN_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.warn(
      `[startup] Missing environment variables: ${missing.join(", ")}. ` +
        `Some features will be unavailable until they are configured.`
    );
  }

  // 弱密钥告警
  const weak = ["dev-secret-key", "dev-admin-key"];
  if (weak.includes(process.env.STUDIO_API_KEY ?? "") || weak.includes(process.env.ADMIN_KEY ?? "")) {
    console.warn("[startup] Weak default keys detected — set strong random keys in production.");
  }
}
