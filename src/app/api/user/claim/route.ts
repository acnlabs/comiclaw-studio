import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { unauthorized, badRequest, notFoundJson, forbidden } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/userHandle";
import { hasSettledOwner } from "@/lib/owner";

// 登录用户认领项目:持有 shareToken 即视为所有权凭证。
// 仅无主的 PRIVATE 客户单可认领。已有人 / agent / 组织东家的不能抢。
// PUBLIC 共创项目禁止认领。
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

  if (project.visibility === "PUBLIC") {
    return forbidden("PUBLIC projects cannot be claimed via share link");
  }

  if (project.ownerUserId === sub) {
    return Response.json({ claimed: false, alreadyOwned: true });
  }
  if (hasSettledOwner(project)) {
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
