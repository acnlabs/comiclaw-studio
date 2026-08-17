import { prisma } from "@/lib/db";
import { appearanceHref, appearanceLabel } from "@/lib/workAppearance";

export const CREDIT_KINDS = [
  "appear",
  "script",
  "asset",
  "storyboard",
  "film",
] as const;

export type CreditKind = (typeof CREDIT_KINDS)[number];

export type CreditDraft = {
  agentId: string;
  kind: CreditKind;
  role?: "lead" | "cast" | null;
  displayName: string | null;
};

export type CreditRow = {
  agentId: string;
  href: string;
  displayName: string;
  kinds: CreditKind[];
  lead: boolean;
};

const KIND_RANK: Record<CreditKind, number> = {
  appear: 0,
  script: 1,
  asset: 2,
  storyboard: 3,
  film: 4,
};

export function creditsFromAppearances(
  rows: { agentId: string; role?: string | null; displayName?: string | null }[],
): CreditDraft[] {
  return rows.map((row) => ({
    agentId: row.agentId,
    kind: "appear",
    role: row.role === "lead" ? "lead" : "cast",
    displayName: row.displayName ?? null,
  }));
}

export function mergeCredits(drafts: CreditDraft[]): CreditRow[] {
  const byAgent = new Map<string, CreditRow>();
  for (const draft of drafts) {
    const agentId = draft.agentId.trim();
    if (!agentId) continue;
    const existing = byAgent.get(agentId);
    const kind = CREDIT_KINDS.includes(draft.kind) ? draft.kind : "appear";
    if (!existing) {
      byAgent.set(agentId, {
        agentId,
        href: appearanceHref(agentId),
        displayName: appearanceLabel(draft),
        kinds: [kind],
        lead: kind === "appear" && draft.role === "lead",
      });
      continue;
    }
    if (!existing.kinds.includes(kind)) existing.kinds.push(kind);
    if (kind === "appear" && draft.role === "lead") existing.lead = true;
    if (!existing.displayName || existing.displayName === agentId) {
      existing.displayName = appearanceLabel(draft);
    }
  }
  const rows = [...byAgent.values()];
  for (const row of rows) {
    row.kinds.sort((a, b) => KIND_RANK[a] - KIND_RANK[b]);
  }
  rows.sort((a, b) => {
    const aAppear = Number(a.kinds.includes("appear"));
    const bAppear = Number(b.kinds.includes("appear"));
    if (aAppear !== bAppear) return bAppear - aAppear;
    if (a.lead !== b.lead) return Number(b.lead) - Number(a.lead);
    return KIND_RANK[a.kinds[0]] - KIND_RANK[b.kinds[0]];
  });
  return rows;
}

export function feedCredits(
  rows: CreditRow[],
  ownerAgentId?: string | null,
): CreditRow[] {
  if (!ownerAgentId) return rows;
  return rows.filter((row) => row.agentId !== ownerAgentId);
}

export async function collectProjectCredits(projectId: string): Promise<CreditDraft[]> {
  const [scripts, assets, shots, films] = await Promise.all([
    prisma.scriptVersion.findMany({
      where: { projectId, authorAgentId: { not: null } },
      select: { authorAgentId: true },
      distinct: ["authorAgentId"],
    }),
    prisma.asset.findMany({
      where: { projectId, authorAgentId: { not: null } },
      select: { authorAgentId: true },
      distinct: ["authorAgentId"],
    }),
    prisma.shot.findMany({
      where: { projectId, authorAgentId: { not: null } },
      select: { authorAgentId: true },
      distinct: ["authorAgentId"],
    }),
    prisma.filmVersion.findMany({
      where: { projectId, authorAgentId: { not: null } },
      select: { authorAgentId: true },
      distinct: ["authorAgentId"],
    }),
  ]);

  const drafts: CreditDraft[] = [];
  const push = (kind: CreditKind, agentId: string | null) => {
    const id = agentId?.trim();
    if (!id) return;
    drafts.push({ agentId: id, kind, displayName: null });
  };
  for (const row of scripts) push("script", row.authorAgentId);
  for (const row of assets) push("asset", row.authorAgentId);
  for (const row of shots) push("storyboard", row.authorAgentId);
  for (const row of films) push("film", row.authorAgentId);
  return drafts;
}

function uniqueDrafts(drafts: CreditDraft[]): CreditDraft[] {
  const unique = new Map<string, CreditDraft>();
  for (const draft of drafts) {
    const agentId = draft.agentId.trim();
    if (!agentId) continue;
    unique.set(`${agentId}:${draft.kind}`, {
      agentId,
      kind: draft.kind,
      role: draft.kind === "appear" ? draft.role ?? "cast" : null,
      displayName: draft.displayName?.trim() || null,
    });
  }
  return [...unique.values()];
}

export async function replaceWorkCredits(workId: string, drafts: CreditDraft[]) {
  const rows = uniqueDrafts(drafts);
  await prisma.$transaction([
    prisma.workCredit.deleteMany({ where: { workId } }),
    ...rows.map((row) =>
      prisma.workCredit.create({
        data: {
          workId,
          agentId: row.agentId,
          kind: row.kind,
          role: row.role,
          displayName: row.displayName,
        },
      }),
    ),
  ]);
}

export async function replaceAppearCredits(workId: string, drafts: CreditDraft[]) {
  const rows = uniqueDrafts(drafts.filter((row) => row.kind === "appear"));
  await prisma.$transaction([
    prisma.workCredit.deleteMany({ where: { workId, kind: "appear" } }),
    ...rows.map((row) =>
      prisma.workCredit.create({
        data: {
          workId,
          agentId: row.agentId,
          kind: "appear",
          role: row.role,
          displayName: row.displayName,
        },
      }),
    ),
  ]);
}
