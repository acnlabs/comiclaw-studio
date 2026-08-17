import { prisma } from "@/lib/db";

export type AppearanceRole = "lead" | "cast";

export type AppearanceDraft = {
  agentId: string;
  characterId?: string | null;
  role: AppearanceRole;
  displayName: string | null;
};

export type AppearanceCredit = {
  agentId: string;
  href: string;
  displayName: string;
  role: AppearanceRole;
};

const FEED_CAST_VISIBLE = 2;

export function appearanceHref(agentId: string): string {
  return `/agents/${encodeURIComponent(agentId)}`;
}

export function appearanceLabel(row: {
  agentId: string;
  displayName?: string | null;
}): string {
  const name = row.displayName?.trim();
  return name || row.agentId;
}

export function toAppearanceCredits(
  rows: {
    agentId: string;
    displayName?: string | null;
    role?: string | null;
  }[],
): AppearanceCredit[] {
  const seen = new Set<string>();
  const credits: AppearanceCredit[] = [];
  for (const row of rows) {
    const agentId = row.agentId.trim();
    if (!agentId || seen.has(agentId)) continue;
    seen.add(agentId);
    credits.push({
      agentId,
      href: appearanceHref(agentId),
      displayName: appearanceLabel(row),
      role: row.role === "lead" ? "lead" : "cast",
    });
  }
  credits.sort((a, b) => Number(b.role === "lead") - Number(a.role === "lead"));
  return credits;
}

/** 推荐流:东家若也在演员表里不重复;最多露两个,其余收成「等 N 人」。 */
export function feedCastCredits(
  rows: AppearanceCredit[],
  ownerAgentId?: string | null,
): { visible: AppearanceCredit[]; extra: number } {
  const filtered = ownerAgentId
    ? rows.filter((row) => row.agentId !== ownerAgentId)
    : rows;
  return {
    visible: filtered.slice(0, FEED_CAST_VISIBLE),
    extra: Math.max(0, filtered.length - FEED_CAST_VISIBLE),
  };
}

export async function collectProjectAppearances(args: {
  projectId: string;
  workId?: string;
  leadAgentId?: string | null;
}): Promise<AppearanceDraft[]> {
  const characters = await prisma.agentCharacter.findMany({
    where: {
      acnAgentId: { not: null },
      OR: [
        { sourceProjectId: args.projectId },
        { licenses: { some: { projectId: args.projectId, status: "GRANTED" } } },
        { asset: { is: { projectId: args.projectId, type: "CHARACTER" } } },
        ...(args.workId ? [{ castIn: { some: { workId: args.workId } } }] : []),
      ],
    },
    select: { id: true, acnAgentId: true, agentName: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  const byAgent = new Map<string, AppearanceDraft>();
  for (const character of characters) {
    const agentId = character.acnAgentId?.trim();
    if (!agentId || byAgent.has(agentId)) continue;
    byAgent.set(agentId, {
      agentId,
      characterId: character.id,
      role: "cast",
      displayName: character.agentName?.trim() || character.name,
    });
  }

  const lead = args.leadAgentId?.trim();
  if (lead) {
    const existing = byAgent.get(lead);
    if (existing) existing.role = "lead";
    else {
      byAgent.set(lead, {
        agentId: lead,
        characterId: null,
        role: "lead",
        displayName: null,
      });
    }
  }

  return [...byAgent.values()];
}

export async function replaceWorkAppearances(
  workId: string,
  drafts: AppearanceDraft[],
) {
  const unique = toAppearanceCredits(drafts).map((credit) => {
    const draft = drafts.find((row) => row.agentId === credit.agentId);
    return {
      workId,
      agentId: credit.agentId,
      characterId: draft?.characterId ?? null,
      role: credit.role,
      displayName: draft?.displayName?.trim() || credit.displayName,
    };
  });

  await prisma.$transaction([
    prisma.workAppearance.deleteMany({ where: { workId } }),
    ...(unique.length
      ? [
          prisma.workAppearance.createMany({
            data: unique,
          }),
        ]
      : []),
  ]);
}

export async function appearancesFromCharacterIds(
  characterIds: string[],
  leadAgentId?: string | null,
): Promise<AppearanceDraft[]> {
  if (characterIds.length === 0 && !leadAgentId) return [];
  const characters = characterIds.length
    ? await prisma.agentCharacter.findMany({
        where: { id: { in: characterIds } },
        select: { id: true, acnAgentId: true, agentName: true, name: true },
      })
    : [];
  const drafts: AppearanceDraft[] = [];
  const seen = new Set<string>();
  for (const character of characters) {
    const agentId = character.acnAgentId?.trim();
    if (!agentId || seen.has(agentId)) continue;
    seen.add(agentId);
    drafts.push({
      agentId,
      characterId: character.id,
      role: agentId === leadAgentId ? "lead" : "cast",
      displayName: character.agentName?.trim() || character.name,
    });
  }
  const lead = leadAgentId?.trim();
  if (lead && !seen.has(lead)) {
    drafts.push({
      agentId: lead,
      characterId: null,
      role: "lead",
      displayName: null,
    });
  }
  return drafts;
}
