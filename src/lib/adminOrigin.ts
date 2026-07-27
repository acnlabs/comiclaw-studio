import { forbidden } from "@/lib/auth";

/**
 * Mitigate cookie CSRF on mutating admin routes: require Origin or Referer
 * whose host matches this request's Host (SameSite=Lax is not enough alone).
 */
export function assertAdminSameOrigin(req: Request): Response | null {
  const host = req.headers.get("host")?.trim();
  if (!host) return forbidden("Missing Host");

  const origin = req.headers.get("origin")?.trim();
  if (origin) {
    try {
      if (new URL(origin).host === host) return null;
    } catch {
      /* fall through */
    }
    return forbidden("Invalid Origin");
  }

  const referer = req.headers.get("referer")?.trim();
  if (referer) {
    try {
      if (new URL(referer).host === host) return null;
    } catch {
      /* fall through */
    }
    return forbidden("Invalid Referer");
  }

  return forbidden("Missing Origin");
}
