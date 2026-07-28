import { verifyUserToken } from "@/lib/userAuth";
import { findFullProjectByToken } from "@/lib/projectQuery";
import { unauthorized, notFoundJson } from "@/lib/auth";
import { assertCanViewProject } from "@/lib/projectAccess";

type Ctx = { params: Promise<{ token: string }> };

// 登录用户读取项目全量数据(PUBLIC / 非私密可读;私密仅主人)
export async function GET(req: Request, ctx: Ctx) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const { token } = await ctx.params;
  const project = await findFullProjectByToken(token);
  if (!project) return notFoundJson();

  const denied = assertCanViewProject(project, sub);
  if (denied) return denied;

  const isOwner = project.ownerUserId === sub;
  return Response.json({ project, isOwner });
}
