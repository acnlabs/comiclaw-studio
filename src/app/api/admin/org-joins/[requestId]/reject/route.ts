import { z } from "zod";
import { withAdminSession } from "@/lib/adminSession";
import { badRequest, notFoundJson } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rejectJoinRequest } from "@/lib/orgJoin";

type Ctx = { params: Promise<{ requestId: string }> };

const bodySchema = z.object({
  decisionNote: z.string().trim().max(500).optional().nullable(),
});

/** Reject a pending join request (ADMIN_KEY cookie). */
export const POST = withAdminSession(async (req, ctx: Ctx) => {
  const { requestId: rawId } = await ctx.params;
  const requestId = rawId?.trim();
  if (!requestId) return notFoundJson();

  const raw = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return badRequest(
      parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ")
    );
  }

  const row = await prisma.orgJoinRequest.findUnique({
    where: { id: requestId },
    select: { acnOrgId: true },
  });
  if (!row) return notFoundJson("Join request not found");

  const result = await rejectJoinRequest({
    requestId,
    expectedOrgId: row.acnOrgId,
    decisionNote: parsed.data.decisionNote,
  });
  if (result instanceof Response) return result;
  return Response.json({ status: "rejected", ...result });
});
