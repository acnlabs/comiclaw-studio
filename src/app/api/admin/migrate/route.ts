import { checkApiKey, unauthorized } from "@/lib/auth";
import { execFileSync } from "child_process";
import { resolve } from "path";

// 一次性迁移端点:部署后调用一次建表,之后由 vercel-build 的 migrate deploy 接管。
export async function POST(req: Request) {
  if (!checkApiKey(req)) return unauthorized();
  const prismaBin = resolve(process.cwd(), "node_modules", ".bin", "prisma");
  try {
    const out = execFileSync(prismaBin, ["migrate", "deploy"], {
      env: { ...process.env },
      encoding: "utf8",
    });
    return Response.json({ ok: true, output: out });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
