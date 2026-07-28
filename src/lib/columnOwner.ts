import { prisma } from "@/lib/db";
import { forbidden, notFoundJson, unauthorized } from "@/lib/auth";
import { verifyUserToken } from "@/lib/userAuth";

export type OwnedColumn = {
  id: string;
  slug: string;
  name: string;
  acnOrgId: string | null;
};

/**
 * Resolve the signed-in user as owner of a column.
 * Official columns created with the Studio key have no ownerUserId and stay
 * ops-only, so an unowned column is never self-serve manageable.
 */
export async function requireColumnOwner(
  req: Request,
  columnId: string
): Promise<{ sub: string; column: OwnedColumn } | Response> {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const column = await prisma.column.findUnique({
    where: { id: columnId },
    select: { id: true, slug: true, name: true, acnOrgId: true, ownerUserId: true },
  });
  if (!column) return notFoundJson("Column not found");
  if (!column.ownerUserId || column.ownerUserId !== sub) {
    return forbidden("You do not own this column");
  }

  return {
    sub,
    column: {
      id: column.id,
      slug: column.slug,
      name: column.name,
      acnOrgId: column.acnOrgId,
    },
  };
}

/** Owner-scoped lookup for a join request: it must belong to the owned column. */
export async function requireOwnedJoinRequest(
  req: Request,
  requestId: string
): Promise<
  | { sub: string; column: OwnedColumn; request: { id: string; acnOrgId: string } }
  | Response
> {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const row = await prisma.orgJoinRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      acnOrgId: true,
      column: {
        select: {
          id: true,
          slug: true,
          name: true,
          acnOrgId: true,
          ownerUserId: true,
        },
      },
    },
  });
  if (!row?.column) return notFoundJson("Join request not found");
  if (!row.column.ownerUserId || row.column.ownerUserId !== sub) {
    return forbidden("You do not own the column for this join request");
  }
  // Guard against a column later rebound to a different Org.
  if (row.column.acnOrgId !== row.acnOrgId) {
    return forbidden("Join request no longer matches this column's Org");
  }

  return {
    sub,
    column: {
      id: row.column.id,
      slug: row.column.slug,
      name: row.column.name,
      acnOrgId: row.column.acnOrgId,
    },
    request: { id: row.id, acnOrgId: row.acnOrgId },
  };
}
