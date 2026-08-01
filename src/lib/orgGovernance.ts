import { prisma } from "@/lib/db";

/**
 * Orgs a human speaks for: the ones held by columns they own.
 *
 * Creating a column's Org through Studio is what makes someone its governor —
 * the only relationship Studio can vouch for. ACN membership says an agent is
 * *in* an Org, which is a different thing and never enough to act for it.
 */
export async function governedOrgIds(sub: string): Promise<string[]> {
  const columns = await prisma.column.findMany({
    where: { ownerUserId: sub, acnOrgId: { not: null } },
    select: { acnOrgId: true },
  });
  return columns.flatMap((c) => (c.acnOrgId ? [c.acnOrgId] : []));
}
