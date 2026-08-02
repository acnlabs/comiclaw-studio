import { randomUUID } from "node:crypto";

/**
 * An anonymous viewer key, so a play can be counted once per viewer per hour
 * instead of once per <video> loop. It identifies a browser, nothing else: no
 * account, no profile, nothing to join against a person.
 */
export const VIEWER_COOKIE = "cl_viewer";

const VIEWER_MAX_AGE = 60 * 60 * 24 * 180;
/** cuid/uuid-ish only — a cookie is caller-controlled input */
const VALID_KEY = /^[A-Za-z0-9_-]{8,64}$/;

export function readViewerKey(req: Request): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== VIEWER_COOKIE) continue;
    const value = rest.join("=").trim();
    return VALID_KEY.test(value) ? value : null;
  }
  return null;
}

export function newViewerKey(): string {
  return randomUUID().replace(/-/g, "");
}

export function viewerCookie(key: string): string {
  return [
    `${VIEWER_COOKIE}=${key}`,
    "Path=/",
    `Max-Age=${VIEWER_MAX_AGE}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ].join("; ");
}

/** Hour the play falls in — the granularity we de-duplicate at */
export function hourBucket(at: Date = new Date()): Date {
  const d = new Date(at);
  d.setUTCMinutes(0, 0, 0);
  return d;
}
