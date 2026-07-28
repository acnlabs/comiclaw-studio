import { notFoundJson } from "@/lib/auth";
import { requireOwnedJoinRequest } from "@/lib/columnOwner";
import { approveJoinRequest } from "@/lib/orgJoin";

type Ctx = { params: Promise<{ requestId: string }> };

/**
 * Column owner approves a join request for their own column's Org.
 * Role is fixed to worker: granting elevated ACN roles stays an ops action.
 */
export async function POST(req: Request, ctx: Ctx) {
  const { requestId: rawId } = await ctx.params;
  const requestId = rawId?.trim();
  if (!requestId) return notFoundJson();

  const access = await requireOwnedJoinRequest(req, requestId);
  if (access instanceof Response) return access;

  const result = await approveJoinRequest({
    requestId,
    expectedOrgId: access.request.acnOrgId,
    role: "worker",
  });
  if (result instanceof Response) return result;
  return Response.json({ status: "approved", ...result });
}
