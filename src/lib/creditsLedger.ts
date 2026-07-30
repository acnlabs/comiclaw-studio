/**
 * comiclaw-side Credits attribution.
 *
 * Balances, top-ups and payouts live in AgentPlanet — that is the ledger of
 * record. Studio only knows *why* a transaction happened (which character was
 * licensed, which project generated what), so this module summarises
 * attribution and never tries to restate a balance.
 */

export type EarnedRow = {
  id: string;
  characterId: string;
  characterName: string;
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

export function summarizeEarned(rows: EarnedRow[]): {
  total: number;
  byCharacter: EarnedByCharacter[];
} {
  const map = new Map<string, EarnedByCharacter>();
  let total = 0;

  for (const row of rows) {
    total += row.points;
    const current = map.get(row.characterId);
    if (current) {
      current.licenseCount += 1;
      current.credits += row.points;
    } else {
      map.set(row.characterId, {
        characterId: row.characterId,
        characterName: row.characterName,
        licenseCount: 1,
        credits: row.points,
      });
    }
  }

  return {
    total,
    byCharacter: [...map.values()].sort((a, b) => b.credits - a.credits),
  };
}

/**
 * Only SUCCESS rows moved money. Failed and insufficient-balance attempts stay
 * in the list for troubleshooting but must not inflate the spend total.
 */
export function summarizeSpent(rows: SpentRow[]): {
  total: number;
  byAction: SpentByAction[];
  failedCount: number;
} {
  const map = new Map<string, SpentByAction>();
  let total = 0;
  let failedCount = 0;

  for (const row of rows) {
    if (row.status !== "SUCCESS") {
      failedCount += 1;
      continue;
    }
    const amount = row.amount ?? 0;
    total += amount;
    const key = row.action ?? "unknown";
    const current = map.get(key);
    if (current) {
      current.count += 1;
      current.credits += amount;
    } else {
      map.set(key, { action: key, count: 1, credits: amount });
    }
  }

  return {
    total,
    byAction: [...map.values()].sort((a, b) => b.credits - a.credits),
    failedCount,
  };
}
