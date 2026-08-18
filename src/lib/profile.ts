import { prisma } from "@/lib/db";
import { fetchOrgDisplayName } from "@/lib/acnOrg";
import { agentPlanetProfileUrl } from "@/lib/agentLinks";
import { fetchAgentDisplayName } from "@/lib/agentplanet";
import { isOwnerKind, type OwnerKind } from "@/lib/owner";
import { ensureUserProfile, isFallbackHandle, isReservedHandle } from "@/lib/userHandle";

export type ProfileKind = OwnerKind;

export type PublicProfile = {
  kind: ProfileKind;
  id: string;
  handle: string | null;
  displayName: string;
  href: string;
  externalHref: string | null;
};

export function profileHref(args: {
  kind: string | null | undefined;
  userId?: string | null;
  agentId?: string | null;
  orgId?: string | null;
  handle?: string | null;
}): string | null {
  if (args.kind === "user") {
    if (args.handle) return `/u/${encodeURIComponent(args.handle)}`;
    return null;
  }
  if (args.kind === "agent" && args.agentId) {
    return `/agents/${encodeURIComponent(args.agentId)}`;
  }
  if (args.kind === "org" && args.orgId) {
    return `/orgs/${encodeURIComponent(args.orgId)}`;
  }
  return null;
}

export async function profileHrefForOwner(owner: {
  ownerKind: string | null;
  ownerUserId: string | null;
  ownerAgentId: string | null;
  ownerOrgId: string | null;
}): Promise<string | null> {
  if (!isOwnerKind(owner.ownerKind)) return null;
  if (owner.ownerKind === "user" && owner.ownerUserId) {
    const profile = await prisma.userProfile.findUnique({
      where: { userId: owner.ownerUserId },
      select: { handle: true },
    });
    return profileHref({ kind: "user", handle: profile?.handle ?? null });
  }
  return profileHref({
    kind: owner.ownerKind,
    agentId: owner.ownerAgentId,
    orgId: owner.ownerOrgId,
  });
}

export async function loadUserProfile(handle: string): Promise<PublicProfile | null> {
  const key = handle.trim().toLowerCase().replace(/^@/, "");
  if (!key || isReservedHandle(key)) return null;
  const row = await prisma.userProfile.findUnique({ where: { handle: key } });
  if (!row) return null;
  return {
    kind: "user",
    id: row.userId,
    handle: isFallbackHandle(row.handle) ? null : row.handle,
    displayName: row.displayName?.trim() || (isFallbackHandle(row.handle) ? row.handle : `@${row.handle}`),
    href: `/u/${row.handle}`,
    externalHref: null,
  };
}

async function displayNameFromCredits(agentId: string): Promise<string | null> {
  const row = await prisma.workCredit.findFirst({
    where: { agentId, displayName: { not: null } },
    select: { displayName: true },
    orderBy: { createdAt: "desc" },
  });
  const fromCredit = row?.displayName?.trim();
  if (fromCredit) return fromCredit;
  const appeared = await prisma.workAppearance.findFirst({
    where: { agentId, displayName: { not: null } },
    select: { displayName: true },
  });
  return appeared?.displayName?.trim() || null;
}

export async function loadAgentProfile(agentId: string): Promise<PublicProfile> {
  const id = agentId.trim();
  const name = (await fetchAgentDisplayName(id)) ?? (await displayNameFromCredits(id));
  return {
    kind: "agent",
    id,
    handle: null,
    displayName: name || id,
    href: `/agents/${encodeURIComponent(id)}`,
    externalHref: agentPlanetProfileUrl(id),
  };
}

export async function loadOrgProfile(orgId: string): Promise<PublicProfile> {
  const id = orgId.trim();
  const name = await fetchOrgDisplayName(id);
  return {
    kind: "org",
    id,
    handle: null,
    displayName: name || id,
    href: `/orgs/${encodeURIComponent(id)}`,
    externalHref: null,
  };
}

export async function listOwnedWorks(args: {
  kind: ProfileKind;
  id: string;
  includeAppearing?: boolean;
}) {
  const ownerFilter =
    args.kind === "user"
      ? { ownerKind: "user" as const, ownerUserId: args.id }
      : args.kind === "agent"
        ? { ownerKind: "agent" as const, ownerAgentId: args.id }
        : { ownerKind: "org" as const, ownerOrgId: args.id };

  const where =
    args.kind === "agent" && args.includeAppearing
      ? {
          OR: [
            ownerFilter,
            { appearingAgentId: args.id },
            { appearances: { some: { agentId: args.id } } },
            { credits: { some: { agentId: args.id } } },
          ],
        }
      : ownerFilter;

  return prisma.work.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      kind: true,
      category: true,
      title: true,
      coverUrl: true,
      authorName: true,
      publishedAt: true,
      ownerKind: true,
      ownerUserId: true,
      ownerAgentId: true,
      ownerOrgId: true,
      appearingAgentId: true,
      ...(args.includeAppearing
        ? {
            appearances: {
              where: { agentId: args.id },
              select: { agentId: true },
            },
            credits: {
              where: { agentId: args.id },
              select: { kind: true, role: true },
            },
          }
        : {}),
      _count: { select: { episodes: true } },
    },
    take: 100,
  });
}

export async function ensureHandleForUser(userId: string, displayName?: string | null) {
  return ensureUserProfile(userId, displayName);
}

export type WorkAuthorLink = {
  href: string | null;
  handle: string | null;
  displayName: string | null;
};

export { authorLine } from "@/lib/authorLine";

function uniqueIds(ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.map((id) => id?.trim()).filter(Boolean) as string[])];
}

export async function authorLinksForWorks(
  works: {
    ownerKind: string | null;
    ownerUserId: string | null;
    ownerAgentId: string | null;
    ownerOrgId: string | null;
  }[],
): Promise<WorkAuthorLink[]> {
  const userIds = uniqueIds(
    works.filter((w) => w.ownerKind === "user").map((w) => w.ownerUserId),
  );
  const agentIds = uniqueIds(
    works.filter((w) => w.ownerKind === "agent").map((w) => w.ownerAgentId),
  );
  const orgIds = uniqueIds(
    works.filter((w) => w.ownerKind === "org").map((w) => w.ownerOrgId),
  );

  const [users, agentNames, orgNames] = await Promise.all([
    userIds.length
      ? prisma.userProfile.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, handle: true, displayName: true },
        })
      : Promise.resolve([]),
    Promise.all(
      agentIds.map(async (id) => [id, await fetchAgentDisplayName(id)] as const),
    ),
    Promise.all(orgIds.map(async (id) => [id, await fetchOrgDisplayName(id)] as const)),
  ]);
  const userById = new Map(users.map((row) => [row.userId, row]));
  const nameByAgent = new Map(agentNames);
  const nameByOrg = new Map(orgNames);

  return works.map((w) => {
    const user =
      w.ownerKind === "user" && w.ownerUserId
        ? userById.get(w.ownerUserId) ?? null
        : null;
    const rawHandle = user?.handle ?? null;
    const handle = rawHandle && !isFallbackHandle(rawHandle) ? rawHandle : null;
    const displayName =
      w.ownerKind === "user"
        ? user?.displayName?.trim() || null
        : w.ownerKind === "agent" && w.ownerAgentId
          ? nameByAgent.get(w.ownerAgentId) ?? null
          : w.ownerKind === "org" && w.ownerOrgId
            ? nameByOrg.get(w.ownerOrgId) ?? null
            : null;
    return {
      href: profileHref({
        kind: w.ownerKind,
        userId: w.ownerUserId,
        agentId: w.ownerAgentId,
        orgId: w.ownerOrgId,
        handle: rawHandle,
      }),
      handle,
      displayName,
    };
  });
}

export async function profileHrefsForWorks(
  works: {
    ownerKind: string | null;
    ownerUserId: string | null;
    ownerAgentId: string | null;
    ownerOrgId: string | null;
  }[],
): Promise<(string | null)[]> {
  const links = await authorLinksForWorks(works);
  return links.map((l) => l.href);
}
