import { z } from "zod";
import { withAdminSession } from "@/lib/adminSession";
import { badRequest, notFoundJson } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { approveJoinRequest } from "@/lib/orgJoin";

type Ctx = { params: Promise<{ requestId: string }> };

const bodySchema = z.object({
  role: z.string().trim().min(1).max(64).optional(),
});

/** Approve a pending join request (ADMIN_KEY cookie → steward add_member). */
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

  const result = await approveJoinRequest({
    requestId,
    expectedOrgId: row.acnOrgId,
    role: parsed.data.role,
  });
  if (result instanceof Response) return result;
  return Response.json({ status: "approved", ...result });
});
