import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { unauthorized } from "@/lib/auth";

// 我的角色:登录客户名下的数字人及被授权次数。
// 金额归因在 /api/user/credits,余额与到账在 AgentPlanet 钱包。
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
        select: { id: true },
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
  }));

  return Response.json({ characters: result });
}
