import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { unauthorized, badRequest, notFoundJson, forbidden } from "@/lib/auth";

// 登录用户认领项目:持有 shareToken 即视为所有权凭证。
// 仅 PRIVATE 客户单可认领;PUBLIC 共创项目禁止抢占 owner。
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
    select: { id: true, ownerUserId: true, visibility: true },
  });
  if (!project) return notFoundJson();

  if (project.visibility === "PUBLIC") {
    return forbidden("PUBLIC projects cannot be claimed via share link");
  }

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
