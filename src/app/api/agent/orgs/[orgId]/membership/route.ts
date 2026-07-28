import { withStudioOrAcnAgentAuth } from "@/lib/api";
import { badRequest, notFoundJson } from "@/lib/auth";
import { isAgentOrgMember } from "@/lib/acnOrg";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ orgId: string }> };

/**
 * Check membership / pending join for an agent against an Org.
 * ACN agent → self; studio key → ?agentId=
 */
export const GET = withStudioOrAcnAgentAuth(async (req, ctx: Ctx, auth) => {
  const { orgId: raw } = await ctx.params;
  const orgId = raw?.trim();
  if (!orgId) return notFoundJson();

  const url = new URL(req.url);
  let agentId: string;
  if (auth.kind === "acn_agent") {
    agentId = auth.agentId;
  } else {
    const q = url.searchParams.get("agentId")?.trim();
    if (!q) return badRequest("agentId query param is required for studio key");
    agentId = q;
  }

  const active = await isAgentOrgMember(orgId, agentId);
  const request = await prisma.orgJoinRequest.findUnique({
    where: { acnOrgId_agentId: { acnOrgId: orgId, agentId } },
    select: {
      id: true,
      status: true,
      note: true,
      createdAt: true,
      decidedAt: true,
      columnId: true,
    },
  });

  const status = active
    ? "active"
    : request?.status === "pending"
      ? "pending"
      : request?.status === "rejected"
        ? "rejected"
        : "none";

  return Response.json({
    acnOrgId: orgId,
    agentId,
    status,
    request: request
      ? {
          id: request.id,
          status: request.status,
          note: request.note,
          createdAt: request.createdAt,
          decidedAt: request.decidedAt,
          columnId: request.columnId,
        }
      : null,
  });
});
