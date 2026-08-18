import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { unauthorized, badRequest, notFoundJson, forbidden } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/userHandle";
import { decideClaimViaShareLink } from "@/lib/owner";

// 登录用户认领项目:持有 shareToken 即视为所有权凭证。
// 无主私有单、以及官方/agent 代建还没有人东家的私有单可以认领。
// 已有别人或组织东家、PUBLIC 共创，不能抢。
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
    select: {
      id: true,
      ownerKind: true,
      ownerUserId: true,
      ownerAgentId: true,
      ownerOrgId: true,
      visibility: true,
    },
  });
  if (!project) return notFoundJson();

  const decision = decideClaimViaShareLink(project, project.visibility, sub);
  if (!decision.ok) {
    if ("alreadyOwned" in decision) {
      return Response.json({ claimed: false, alreadyOwned: true });
    }
    if (decision.reason === "public") {
      return forbidden("PUBLIC projects cannot be claimed via share link");
    }
    return Response.json({ claimed: false, ownedByOther: true });
  }

  await ensureUserProfile(sub);
  const owner = {
    ownerKind: "user" as const,
    ownerUserId: sub,
    ownerAgentId: null,
    ownerOrgId: null,
  };
  await prisma.$transaction([
    prisma.project.update({
      where: { id: project.id },
      data: owner,
    }),
    prisma.work.updateMany({
      where: { projectId: project.id },
      data: owner,
    }),
  ]);
  return Response.json({ claimed: true });
}
