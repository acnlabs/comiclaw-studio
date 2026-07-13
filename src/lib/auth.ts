import { timingSafeEqual } from "crypto";

// 恒定时间字符串比较,避免时序攻击
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // 长度不同直接失败,但仍走一次比较以尽量减少长度侧信道
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function checkApiKey(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  const key = header.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.STUDIO_API_KEY;
  if (!expected || !key) return false;
  return safeEqual(key, expected);
}

export function checkAdminKey(key: string | undefined | null): boolean {
  const expected = process.env.ADMIN_KEY;
  if (!expected || !key) return false;
  return safeEqual(key, expected);
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export function notFoundJson(message = "Not found") {
  return Response.json({ error: message }, { status: 404 });
}

export function conflict(message: string) {
  return Response.json({ error: message }, { status: 409 });
}

export function serverError(message = "Internal server error") {
  return Response.json({ error: message }, { status: 500 });
}
