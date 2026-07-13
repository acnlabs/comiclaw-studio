import { verifyUserToken } from "@/lib/userAuth";
import { findFullProjectByToken } from "@/lib/projectQuery";
import { unauthorized, notFoundJson } from "@/lib/auth";

type Ctx = { params: Promise<{ token: string }> };

// 登录用户读取项目全量数据(私密项目仅主人可读)
export async function GET(req: Request, ctx: Ctx) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const { token } = await ctx.params;
  const project = await findFullProjectByToken(token);
  if (!project) return notFoundJson();

  const isOwner = project.ownerUserId === sub;
  if (project.isPrivate && !isOwner) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return Response.json({ project, isOwner });
}
