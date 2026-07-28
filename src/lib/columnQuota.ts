import { Prisma } from "@prisma/client";
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
  return nonNegativeInt(
    process.env.USER_MAX_OWNED_COLUMNS,
    DEFAULT_MAX_OWNED_COLUMNS
  );
}

export function maxOrgCreatesPerDay(): number {
  return nonNegativeInt(
    process.env.USER_MAX_ORG_CREATES_PER_DAY,
    DEFAULT_MAX_ORG_CREATES_PER_DAY
  );
}

/** Unset / blank / invalid falls back; an explicit 0 blocks self-serve. */
export function nonNegativeInt(
  raw: string | undefined | null,
  fallback: number
): number {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return fallback;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
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

export type ClaimResult =
  | { ok: true; columnId: string }
  | { ok: false; decision: Extract<QuotaDecision, { allowed: false }> };

/**
 * Reserve one column slot for a user and insert the row in the same
 * serializable transaction, so concurrent requests cannot both pass the count.
 * `orgCreatedAt` is stamped before calling ACN so a failed bind still consumes
 * the daily allowance instead of leaving an uncounted orphan Org.
 */
export async function claimColumnSlot(args: {
  ownerUserId: string;
  slug: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  contributePolicy: string;
  wantsOrgCreate: boolean;
}): Promise<ClaimResult> {
  return prisma.$transaction(
    async (tx) => {
      const ownedColumns = await tx.column.count({
        where: { ownerUserId: args.ownerUserId },
      });
      const orgCreatesToday = args.wantsOrgCreate
        ? await tx.column.count({
            where: {
              ownerUserId: args.ownerUserId,
              orgCreatedAt: { gte: startOfUtcDay() },
            },
          })
        : 0;

      const decision = evaluateColumnQuota({
        ownedColumns,
        orgCreatesToday,
        wantsOrgCreate: args.wantsOrgCreate,
        maxColumns: maxOwnedColumns(),
        maxOrgsPerDay: maxOrgCreatesPerDay(),
      });
      if (!decision.allowed) return { ok: false as const, decision };

      const column = await tx.column.create({
        data: {
          slug: args.slug,
          name: args.name,
          description: args.description,
          coverUrl: args.coverUrl,
          ownerUserId: args.ownerUserId,
          contributePolicy: args.contributePolicy,
          orgCreatedAt: args.wantsOrgCreate ? new Date() : null,
        },
        select: { id: true },
      });
      return { ok: true as const, columnId: column.id };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
