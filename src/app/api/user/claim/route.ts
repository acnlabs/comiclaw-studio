import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { unauthorized, badRequest, notFoundJson } from "@/lib/auth";

// 登录用户认领项目:持有 shareToken 即视为所有权凭证。
// 项目无主时绑定到当前用户;已有主人则不变(仍可通过链接查看)。
export async function POST(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const body = await req.json().catch(() => null);
  const shareToken = body?.shareToken;
  if (typeof shareToken !== "string" || !shareToken) {
    return badRequest("`shareToken` is required");
  }

  const project = await prisma.project.findUnique({
    where: { shareToken },
    select: { id: true, ownerUserId: true },
  });
  if (!project) return notFoundJson();

  if (project.ownerUserId === sub) {
    return Response.json({ claimed: false, alreadyOwned: true });
  }
  if (project.ownerUserId) {
    return Response.json({ claimed: false, ownedByOther: true });
  }

  await prisma.project.update({
    where: { id: project.id },
    data: { ownerUserId: sub },
  });
  return Response.json({ claimed: true });
}
