import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { unauthorized } from "@/lib/auth";

// 我的项目:列出当前登录用户名下的项目
export async function GET(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const projects = await prisma.project.findMany({
    where: { ownerUserId: sub },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      clientName: true,
      agentName: true,
      coverUrl: true,
      currentStage: true,
      shareToken: true,
      updatedAt: true,
    },
  });
  return Response.json({ projects });
}
