import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { unauthorized, notFoundJson } from "@/lib/auth";

type Ctx = { params: Promise<{ token: string }> };

// 查询当前登录用户对某项目的角色(是否主人)与私密状态
export async function GET(req: Request, ctx: Ctx) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const { token } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { shareToken: token },
    select: { ownerUserId: true, isPrivate: true },
  });
  if (!project) return notFoundJson();

  return Response.json({
    isOwner: project.ownerUserId === sub,
    isPrivate: project.isPrivate,
  });
}
