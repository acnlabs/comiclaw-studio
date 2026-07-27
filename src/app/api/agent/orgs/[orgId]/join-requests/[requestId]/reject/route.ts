import { z } from "zod";
import { withAgentAuth } from "@/lib/api";
import { badRequest, conflict, notFoundJson } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

  const updated = await prisma.orgJoinRequest.updateMany({
    where: { id: row.id, status: "pending" },
    data: {
      status: "rejected",
      decidedAt: new Date(),
      ...(decisionNote !== undefined
        ? { decisionNote: decisionNote?.trim() || null }
        : {}),
    },
  });
  if (updated.count === 0) {
    return conflict("Join request is no longer pending");
  }

  const request = await prisma.orgJoinRequest.findUniqueOrThrow({
    where: { id: row.id },
    select: {
      id: true,
      acnOrgId: true,
      agentId: true,
      status: true,
      note: true,
      decisionNote: true,
      decidedAt: true,
    },
  });

  return Response.json({ status: "rejected", request });
});
