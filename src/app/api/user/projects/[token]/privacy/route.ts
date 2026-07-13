import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { unauthorized, badRequest, notFoundJson } from "@/lib/auth";

type Ctx = { params: Promise<{ token: string }> };

// 主人切换项目私密状态
export async function POST(req: Request, ctx: Ctx) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const body = await req.json().catch(() => null);
  if (typeof body?.isPrivate !== "boolean") {
    return badRequest("`isPrivate` (boolean) is required");
  }

  const { token } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { shareToken: token },
    select: { id: true, ownerUserId: true },
  });
  if (!project) return notFoundJson();
  if (project.ownerUserId !== sub) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.project.update({
    where: { id: project.id },
    data: { isPrivate: body.isPrivate },
  });
  return Response.json({ isPrivate: body.isPrivate });
}
