import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { unauthorized } from "@/lib/auth";
import {
  shapeEarnedGroups,
  shapeSpentGroups,
  type EarnedRow,
  type SpentRow,
} from "@/lib/creditsLedger";

/**
 * Each side is windowed separately so filtering by income still shows recent
 * income even when spend dominates. That means the merged list is not a single
 * "latest N", so the UI only says the list is a window — never how deep.
 */
const RECENT_LIMIT = 50;

/**
 * Credits attribution for the signed-in user.
 * Balance stays in AgentPlanet; this only explains what comiclaw charged and
 * what their characters earned.
 */
export async function GET(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  // Earnings are one thing now: characters, scenes and props all sell usage
  // rights through AssetLicense. Before the merge this only counted casting,
  // so someone who sold a scene saw nothing here at all.
  //
  // Who earned it is the asset's seller — the registered owner if there is
  // one, otherwise whoever made it (a character's backing asset is not
  // registered until it is priced).
  const earnedWhere: Prisma.AssetLicenseWhereInput = {
    status: "GRANTED",
    licenseeSub: { not: sub },
    asset: {
      OR: [
        { ownerType: "user", ownerId: sub },
        { ownerType: null, authorUserId: sub },
      ],
    },
  };
  const spentWhere: Prisma.GenerationChargeRefWhereInput = { userSub: sub };

  const [
    licenses,
    charges,
    earnedGroups,
    spentGroups,
    failedCount,
  ] = await Promise.all([
    prisma.assetLicense.findMany({
      where: earnedWhere,
      orderBy: { createdAt: "desc" },
      take: RECENT_LIMIT,
      select: {
        id: true,
        points: true,
        createdAt: true,
        asset: { select: { id: true, name: true } },
        // A licensee's PRIVATE project name is their business, not the
        // character owner's, so only PUBLIC entries are named below.
        project: { select: { name: true, visibility: true } },
      },
    }),
    prisma.generationChargeRef.findMany({
      where: spentWhere,
      orderBy: { createdAt: "desc" },
      take: RECENT_LIMIT,
      select: {
        id: true,
        projectId: true,
        action: true,
        amount: true,
        status: true,
        createdAt: true,
        project: { select: { name: true } },
      },
    }),
    prisma.assetLicense.groupBy({
      by: ["assetId"],
      where: earnedWhere,
      _sum: { points: true },
      _count: { _all: true },
    }),
    prisma.generationChargeRef.groupBy({
      by: ["action"],
      where: { ...spentWhere, status: "SUCCESS" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.generationChargeRef.count({
      where: { ...spentWhere, status: { not: "SUCCESS" } },
    }),
  ]);

  const assetNames = await prisma.asset.findMany({
    where: { id: { in: earnedGroups.map((g) => g.assetId) } },
    select: { id: true, name: true },
  });
  const namesById = new Map(assetNames.map((a) => [a.id, a.name]));

  const earnedRows: EarnedRow[] = licenses.map((l) => ({
    id: l.id,
    characterId: l.asset.id,
    characterName: l.asset.name,
    projectName:
      l.project?.visibility === "PUBLIC" ? (l.project?.name ?? null) : null,
    points: l.points,
    createdAt: l.createdAt.toISOString(),
  }));

  const spentRows: SpentRow[] = charges.map((c) => ({
    id: c.id,
    projectId: c.projectId,
    projectName: c.project?.name ?? null,
    action: c.action,
    amount: c.amount,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
  }));

  const earned = shapeEarnedGroups(
    earnedGroups.map((g) => ({
      characterId: g.assetId,
      licenseCount: g._count._all,
      credits: g._sum.points,
    })),
    namesById
  );
  const spent = shapeSpentGroups(
    spentGroups.map((g) => ({
      action: g.action,
      count: g._count._all,
      credits: g._sum.amount,
    }))
  );

  return Response.json({
    earned: { ...earned, rows: earnedRows },
    spent: { ...spent, failedCount, rows: spentRows },
    truncated:
      licenses.length >= RECENT_LIMIT || charges.length >= RECENT_LIMIT,
  });
}
