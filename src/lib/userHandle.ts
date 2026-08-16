import { prisma } from "@/lib/db";

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

const RESERVED = new Set([
  "studio",
  "series",
  "discover",
  "collab",
  "assets",
  "characters",
  "agents",
  "orgs",
  "u",
  "my",
  "api",
  "auth",
  "p",
  "columns",
  "credits",
  "casting",
  "license",
  "admin",
  "feed",
  "login",
  "me",
]);

export function isReservedHandle(handle: string): boolean {
  return RESERVED.has(handle.toLowerCase());
}

export function normalizeHandle(raw: string): string | null {
  const handle = raw.trim().toLowerCase().replace(/^@/, "");
  if (!HANDLE_RE.test(handle) || isReservedHandle(handle)) return null;
  return handle;
}

function fallbackHandle(userId: string): string {
  const compact = userId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const tail = (compact.slice(-8) || "user").padEnd(4, "0");
  return `u-${tail}`.slice(0, 32);
}

export async function ensureUserProfile(userId: string, displayName?: string | null) {
  const existing = await prisma.userProfile.findUnique({ where: { userId } });
  if (existing) return existing;

  let handle = fallbackHandle(userId);
  for (let i = 0; i < 8; i++) {
    const taken = await prisma.userProfile.findUnique({ where: { handle } });
    if (!taken) {
      return prisma.userProfile.create({
        data: {
          userId,
          handle,
          displayName: displayName?.trim() || null,
        },
      });
    }
    handle = `${fallbackHandle(userId)}${i + 2}`.slice(0, 32);
  }
  return prisma.userProfile.create({
    data: {
      userId,
      handle: `u-${Date.now().toString(36)}`.slice(0, 32),
      displayName: displayName?.trim() || null,
    },
  });
}
