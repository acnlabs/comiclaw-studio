import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { unauthorized } from "@/lib/auth";
import {
  summarizeEarned,
  summarizeSpent,
  type EarnedRow,
  type SpentRow,
} from "@/lib/creditsLedger";

const RECENT_LIMIT = 50;

/**
 * Credits attribution for the signed-in user.
 * Balance stays in AgentPlanet; this only explains what comiclaw charged and
 * what their characters earned.
 */
export async function GET(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const [licenses, charges] = await Promise.all([
    prisma.castingLicense.findMany({
      where: {
        status: "GRANTED",
        licenseeSub: { not: sub },
        character: { ownerUserId: sub },
      },
      orderBy: { createdAt: "desc" },
      take: RECENT_LIMIT,
      select: {
        id: true,
        points: true,
        createdAt: true,
        character: { select: { id: true, name: true } },
        project: { select: { name: true } },
      },
    }),
    prisma.generationChargeRef.findMany({
      where: { userSub: sub },
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
  ]);

  const earnedRows: EarnedRow[] = licenses.map((l) => ({
    id: l.id,
    characterId: l.character.id,
    characterName: l.character.name,
    projectName: l.project?.name ?? null,
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

  return Response.json({
    earned: { ...summarizeEarned(earnedRows), rows: earnedRows },
    spent: { ...summarizeSpent(spentRows), rows: spentRows },
  });
}
