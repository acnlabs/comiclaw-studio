import { prisma } from "@/lib/db";

/**
 * Per-user limits for self-serve columns.
 *
 * Studio is the only layer that knows which Auth0 user is behind a request:
 * ACN sees every Org create as the platform steward agent, so it can only
 * throttle Studio as a whole. Keep the per-user cap here; ACN keeps its own
 * global per-agent quota.
 */
export const DEFAULT_MAX_OWNED_COLUMNS = 5;
export const DEFAULT_MAX_ORG_CREATES_PER_DAY = 2;

export function maxOwnedColumns(): number {
  return positiveInt(process.env.USER_MAX_OWNED_COLUMNS, DEFAULT_MAX_OWNED_COLUMNS);
}

export function maxOrgCreatesPerDay(): number {
  return positiveInt(
    process.env.USER_MAX_ORG_CREATES_PER_DAY,
    DEFAULT_MAX_ORG_CREATES_PER_DAY
  );
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number((raw ?? "").trim());
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export type QuotaDecision =
  | { allowed: true }
  | { allowed: false; reason: "columns" | "orgs"; limit: number };

/** Pure policy so limits stay testable without a database. */
export function evaluateColumnQuota(args: {
  ownedColumns: number;
  orgCreatesToday: number;
  wantsOrgCreate: boolean;
  maxColumns: number;
  maxOrgsPerDay: number;
}): QuotaDecision {
  if (args.ownedColumns >= args.maxColumns) {
    return { allowed: false, reason: "columns", limit: args.maxColumns };
  }
  if (args.wantsOrgCreate && args.orgCreatesToday >= args.maxOrgsPerDay) {
    return { allowed: false, reason: "orgs", limit: args.maxOrgsPerDay };
  }
  return { allowed: true };
}

export function startOfUtcDay(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

/** Count current usage for a user and apply the policy above. */
export async function checkColumnQuota(args: {
  ownerUserId: string;
  wantsOrgCreate: boolean;
}): Promise<QuotaDecision> {
  const [ownedColumns, orgCreatesToday] = await Promise.all([
    prisma.column.count({ where: { ownerUserId: args.ownerUserId } }),
    args.wantsOrgCreate
      ? prisma.column.count({
          where: {
            ownerUserId: args.ownerUserId,
            acnOrgId: { not: null },
            createdAt: { gte: startOfUtcDay() },
          },
        })
      : Promise.resolve(0),
  ]);

  return evaluateColumnQuota({
    ownedColumns,
    orgCreatesToday,
    wantsOrgCreate: args.wantsOrgCreate,
    maxColumns: maxOwnedColumns(),
    maxOrgsPerDay: maxOrgCreatesPerDay(),
  });
}
