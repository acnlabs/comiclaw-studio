import { cookies } from "next/headers";
import { checkAdminKey, badRequest } from "@/lib/auth";

export const ADMIN_COOKIE = "studio_admin";

// 管理员登录:提交 ADMIN_KEY,校验通过后写入 HttpOnly Cookie,
// 避免密钥出现在 URL / 浏览器历史 / 访问日志中。
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const key = body?.key;
  if (typeof key !== "string" || !checkAdminKey(key)) {
    return badRequest("Invalid key");
  }
  const store = await cookies();
  store.set(ADMIN_COOKIE, key, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 天
  });
  return Response.json({ ok: true });
}

// 登出
export async function DELETE() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  return Response.json({ ok: true });
}
