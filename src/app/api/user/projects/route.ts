import { after } from "next/server";
import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { unauthorized } from "@/lib/auth";
import { reconcilePendingLicenses } from "@/lib/casting";

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
  // 惰性自愈:响应发出后顺手补一遍客户名下卡住的付费授权,不拖慢本次请求
  after(() => reconcilePendingLicenses(sub));
  return Response.json({ projects });
}
