import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { unauthorized } from "@/lib/auth";

// 我的角色:登录客户名下的数字人 + 在 Studio 范围内的选角授权收益统计。
// 这只是「Studio 这个业务归因了多少」,不是财务总账——完整收支(含其它来源、
// 平台抽佣后实际到账)要去 AgentPlanet 钱包看。
export async function GET(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const characters = await prisma.agentCharacter.findMany({
    where: { ownerUserId: sub },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      isPublic: true,
      licensePoints: true,
      storeProductId: true,
      licenses: {
        where: { status: "GRANTED", licenseeSub: { not: sub } },
        select: { points: true },
      },
    },
  });

  const result = characters.map((c) => ({
    id: c.id,
    name: c.name,
    imageUrl: c.imageUrl,
    isPublic: c.isPublic,
    licensePoints: c.licensePoints,
    listed: Boolean(c.storeProductId),
    licensedProjectCount: c.licenses.length,
    totalCreditsEarnedGross: c.licenses.reduce((sum, l) => sum + l.points, 0),
  }));

  return Response.json({ characters: result });
}
