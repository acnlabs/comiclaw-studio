import { prisma } from "@/lib/db";
import {
  ensureUserProfile,
  isFallbackHandle,
  isSeedUserId,
  normalizeHandle,
} from "@/lib/userHandle";

export type AgentPlanetUserIdentity = {
  displayName: string | null;
  username: string | null;
};

const GENERIC_CN = /^用户·.{1,24}$/;

function apiOrigin(): string {
  const raw =
    process.env.AGENTPLANET_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_AGENTPLANET_API_URL?.trim() ||
    "https://api.agentplanet.org";
  return raw.replace(/\/+$/, "");
}

export function isGenericDisplayName(name: string, userId?: string): boolean {
  const n = name.trim();
  if (!n) return true;
  if (userId && n === userId) return true;
  if (n === "微信用户" || n === "WeChat User") return true;
  if (n.startsWith("wechat|") || n.startsWith("wechat:")) return true;
  if (n.startsWith("auth0|")) return true;
  return GENERIC_CN.test(n);
}

export function pickAgentPlanetDisplayName(
  remote: { display_name?: string | null; name?: string | null },
  userId?: string,
): string | null {
  for (const raw of [remote.display_name, remote.name]) {
    const name = raw?.trim();
    if (name && !isGenericDisplayName(name, userId)) return name;
  }
  return null;
}

export function pickAgentPlanetHandle(username?: string | null): string | null {
  if (!username?.trim()) return null;
  return normalizeHandle(username);
}

export function nextUserProfileFromAgentPlanet(args: {
  userId: string;
  handle: string;
  displayName: string | null;
  remote: AgentPlanetUserIdentity;
}): { handle: string; displayName: string | null } {
  if (isSeedUserId(args.userId)) {
    return { handle: args.handle, displayName: args.displayName };
  }
  const displayName = args.remote.displayName ?? args.displayName;
  const remoteHandle = pickAgentPlanetHandle(args.remote.username);
  const handle =
    remoteHandle && (isFallbackHandle(args.handle) || args.handle === remoteHandle)
      ? remoteHandle
      : args.handle;
  return { handle, displayName };
}

export async function fetchAgentPlanetUserIdentity(
  bearer: string,
): Promise<AgentPlanetUserIdentity | null> {
  const token = bearer.trim();
  if (!token) return null;
  try {
    const res = await fetch(`${apiOrigin()}/api/users/me/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      user_id?: string;
      display_name?: string | null;
      name?: string | null;
      username?: string | null;
    };
    return {
      displayName: pickAgentPlanetDisplayName(data, data.user_id),
      username: data.username?.trim() || null,
    };
  } catch {
    return null;
  }
}

const SYNC_TTL_MS = 2 * 60 * 1000;

/** 把 AgentPlanet 的展示名(以及有的话短名)抄到本地。失败保持原样。seed 账号不动。 */
export async function syncUserProfileFromAgentPlanet(
  userId: string,
  bearer: string | null,
) {
  const local = await ensureUserProfile(userId);
  if (isSeedUserId(userId) || !bearer) return local;
  if (
    local.displayName &&
    Date.now() - local.updatedAt.getTime() < SYNC_TTL_MS
  ) {
    return local;
  }

  const remote = await fetchAgentPlanetUserIdentity(bearer);
  if (!remote) return local;

  const next = nextUserProfileFromAgentPlanet({
    userId,
    handle: local.handle,
    displayName: local.displayName,
    remote,
  });
  if (next.handle !== local.handle) {
    const taken = await prisma.userProfile.findUnique({
      where: { handle: next.handle },
      select: { userId: true },
    });
    if (taken && taken.userId !== userId) {
      next.handle = local.handle;
    }
  }
  if (next.handle === local.handle && next.displayName === local.displayName) {
    return local;
  }
  return prisma.userProfile.update({
    where: { userId },
    data: {
      handle: next.handle,
      displayName: next.displayName,
    },
  });
}
