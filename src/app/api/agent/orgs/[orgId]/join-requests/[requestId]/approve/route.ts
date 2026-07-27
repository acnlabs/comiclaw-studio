import { z } from "zod";
import { withAgentAuth } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { approveJoinRequest } from "@/lib/orgJoin";

type Ctx = { params: Promise<{ orgId: string; requestId: string }> };

const bodySchema = z.object({
  role: z.string().trim().min(1).max(40).optional(),
});

/** Approve a pending join request → add agent via ACN steward key. */
export const POST = withAgentAuth(async (req, ctx: Ctx) => {
  const { orgId: rawOrg, requestId } = await ctx.params;
  const orgId = rawOrg?.trim();
  if (!orgId || !requestId?.trim()) return notFoundJson();

  const raw = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw ?? {});
  const role = parsed.success ? parsed.data.role : undefined;

  const row = await approveJoinRequest({
    requestId: requestId.trim(),
    role,
  });
  if (row instanceof Response) return row;
  if (row.request.acnOrgId !== orgId) return notFoundJson("Join request not found");

  return Response.json({
    status: "approved",
    request: row.request,
    member: row.member,
  });
});
