/**
 * comiclaw-side Credits attribution.
 *
 * Balances, top-ups and payouts live in AgentPlanet — that is the ledger of
 * record. Studio only knows *why* a transaction happened (which character was
 * licensed, which project generated what), so this module shapes attribution
 * and never restates a balance.
 *
 * Amount caveats surfaced in the UI, not hidden here:
 * - `CastingLicense.points` is the deal snapshot, i.e. gross before the
 *   platform fee, so earnings are labelled as such.
 * - `GenerationChargeRef.amount` is recorded for troubleshooting; the
 *   authoritative figure is the AgentPlanet transaction, so spend is shown as
 *   an approximation.
 */

export type EarnedRow = {
  id: string;
  characterId: string;
  characterName: string;
  /** Only set for PUBLIC entries — private client project names stay private */
  projectName: string | null;
  points: number;
  createdAt: string;
};

export type SpentRow = {
  id: string;
  projectId: string;
  projectName: string | null;
  action: string | null;
  amount: number | null;
  status: string;
  createdAt: string;
};

export type EarnedByCharacter = {
  characterId: string;
  characterName: string;
  licenseCount: number;
  credits: number;
};

export type SpentByAction = {
  action: string;
  count: number;
  credits: number;
};

/** Grouped straight out of the database so totals cover every row, not a page. */
export type EarnedGroup = {
  characterId: string;
  licenseCount: number;
  credits: number | null;
};

export type SpentGroup = {
  action: string | null;
  count: number;
  credits: number | null;
};

export function shapeEarnedGroups(
  groups: EarnedGroup[],
  namesById: Map<string, string>
): { total: number; byCharacter: EarnedByCharacter[] } {
  const byCharacter = groups
    .map((g) => ({
      characterId: g.characterId,
      characterName: namesById.get(g.characterId) ?? g.characterId,
      licenseCount: g.licenseCount,
      credits: g.credits ?? 0,
    }))
    .sort((a, b) => b.credits - a.credits);

  return {
    total: byCharacter.reduce((sum, c) => sum + c.credits, 0),
    byCharacter,
  };
}

/**
 * One chronological statement, the way a bill reads, so income and spend can
 * be scanned together instead of in two stacked sections.
 */
export type LedgerEntry =
  | {
      kind: "earn";
      id: string;
      characterName: string;
      projectName: string | null;
      points: number;
      createdAt: string;
    }
  | {
      kind: "spend";
      id: string;
      action: string | null;
      projectName: string | null;
      amount: number | null;
      status: string;
      createdAt: string;
    };

export function mergeLedgerEntries(
  earned: EarnedRow[],
  spent: SpentRow[]
): LedgerEntry[] {
  const entries: LedgerEntry[] = [
    ...earned.map(
      (r): LedgerEntry => ({
        kind: "earn",
        id: r.id,
        characterName: r.characterName,
        projectName: r.projectName,
        points: r.points,
        createdAt: r.createdAt,
      })
    ),
    ...spent.map(
      (r): LedgerEntry => ({
        kind: "spend",
        id: r.id,
        action: r.action,
        projectName: r.projectName,
        amount: r.amount,
        status: r.status,
        createdAt: r.createdAt,
      })
    ),
  ];

  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function shapeSpentGroups(groups: SpentGroup[]): {
  total: number;
  byAction: SpentByAction[];
} {
  const byAction = groups
    .map((g) => ({
      action: g.action ?? "unknown",
      count: g.count,
      credits: g.credits ?? 0,
    }))
    .sort((a, b) => b.credits - a.credits);

  return {
    total: byAction.reduce((sum, a) => sum + a.credits, 0),
    byAction,
  };
}
