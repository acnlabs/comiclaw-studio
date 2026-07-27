import { z } from "zod";
import { withAgentAuth, parseBody } from "@/lib/api";
import { badRequest, conflict, notFoundJson } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ orgId: string; requestId: string }> };

const bodySchema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
});

/** Reject a pending join request (Studio key / ops). */
export const POST = withAgentAuth(async (req, ctx: Ctx) => {
  const { orgId: rawOrg, requestId } = await ctx.params;
  const orgId = rawOrg?.trim();
  if (!orgId || !requestId?.trim()) return notFoundJson();

  let note: string | null | undefined;
  try {
    const body = await parseBody(req, bodySchema);
    note = body.note;
  } catch {
    // empty body ok
  }

  const row = await prisma.orgJoinRequest.findUnique({
    where: { id: requestId.trim() },
  });
  if (!row || row.acnOrgId !== orgId) return notFoundJson("Join request not found");
  if (row.status === "approved") {
    return conflict("Cannot reject an already approved request");
  }
  if (row.status === "rejected") {
    return badRequest("Join request already rejected");
  }

  const updated = await prisma.orgJoinRequest.update({
    where: { id: row.id },
    data: {
      status: "rejected",
      decidedAt: new Date(),
      ...(note !== undefined ? { note: note?.trim() || null } : {}),
    },
    select: {
      id: true,
      acnOrgId: true,
      agentId: true,
      status: true,
      note: true,
      decidedAt: true,
    },
  });

  return Response.json({ status: "rejected", request: updated });
});
