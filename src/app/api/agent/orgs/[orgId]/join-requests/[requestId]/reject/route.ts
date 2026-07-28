import { z } from "zod";
import { withAgentAuth } from "@/lib/api";
import { badRequest, notFoundJson } from "@/lib/auth";
import { rejectJoinRequest } from "@/lib/orgJoin";

type Ctx = { params: Promise<{ orgId: string; requestId: string }> };

const bodySchema = z.object({
  /** Ops rejection reason — stored in decisionNote; does not overwrite agent note */
  decisionNote: z.string().trim().max(500).optional().nullable(),
  /** @deprecated use decisionNote */
  note: z.string().trim().max(500).optional().nullable(),
});

/** Reject a pending join request (Studio key / ops). */
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
  const decisionNote =
    parsed.data.decisionNote !== undefined
      ? parsed.data.decisionNote
      : parsed.data.note;

  const result = await rejectJoinRequest({
    requestId: requestId.trim(),
    expectedOrgId: orgId,
    decisionNote,
  });
  if (result instanceof Response) return result;
  return Response.json({ status: "rejected", ...result });
});
