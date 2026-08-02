import { createHash, randomUUID } from "node:crypto";

/**
 * An anonymous viewer key, so a play can be counted once per viewer per hour
 * instead of once per <video> loop. It identifies a browser, nothing else: no
 * account, no profile, nothing to join against a person.
 *
 * The cookie alone cannot be the whole defence: whoever is calling decides
 * whether to send one, so a caller that never sends a cookie looks like an
 * endless stream of first-time viewers. Heat therefore also caps per network
 * per hour, which is the part the caller does not control.
 */
export const VIEWER_COOKIE = "cl_viewer";

/** Plays counted per work, per network, per hour, however many keys are shown */
export const PLAYS_PER_NETWORK_PER_HOUR = 5;

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

/** Client address as the platform reports it; leftmost hop is the caller */
export function clientAddress(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Salted hash of the caller's address. Stored instead of the address itself:
 * we need to recognise "same network, same hour" for the cap, and never need
 * to read an address back. IPv4 is small enough to brute-force unsalted, so
 * the salt matters; it rides on an existing server secret rather than adding a
 * required env var. Rotating that secret resets the counters, which is
 * harmless.
 */
export function networkHash(req: Request): string {
  const salt = process.env.PLAY_HASH_SALT ?? process.env.STUDIO_API_KEY ?? "";
  return createHash("sha256")
    .update(`${salt}:${clientAddress(req)}`)
    .digest("hex")
    .slice(0, 32);
}
