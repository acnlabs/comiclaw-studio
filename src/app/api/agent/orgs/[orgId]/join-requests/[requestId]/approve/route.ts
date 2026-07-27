import { z } from "zod";
import { withAgentAuth } from "@/lib/api";
import { badRequest, notFoundJson } from "@/lib/auth";
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
  if (!parsed.success) {
    return badRequest(
      parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ")
    );
  }

  // expectedOrgId checked inside before any ACN side effect
  const row = await approveJoinRequest({
    requestId: requestId.trim(),
    expectedOrgId: orgId,
    role: parsed.data.role,
  });
  if (row instanceof Response) return row;

  return Response.json({
    status: "approved",
    request: row.request,
    member: row.member,
  });
});
