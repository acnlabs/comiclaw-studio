import { prisma } from "@/lib/db";
import {
  acnOrgConfigured,
  addAcnOrgMember,
  getAcnOrg,
  isAgentOrgMember,
  orgJoinPolicy,
} from "@/lib/acnOrg";
import { badRequest, conflict, notFoundJson, serverError } from "@/lib/auth";

export type ResolvedOrgTarget = {
  acnOrgId: string;
  columnId: string | null;
  columnSlug: string | null;
};

/** Resolve Org from columnSlug and/or acnOrgId (column wins for id when both given and mismatch → error). */
export async function resolveOrgTarget(args: {
  columnSlug?: string | null;
  acnOrgId?: string | null;
}): Promise<ResolvedOrgTarget | Response> {
  const slug = args.columnSlug?.trim() || null;
  const orgId = args.acnOrgId?.trim() || null;

  if (!slug && !orgId) {
    return badRequest("Provide columnSlug or acnOrgId");
  }

  if (slug) {
    const column = await prisma.column.findUnique({
      where: { slug },
      select: { id: true, slug: true, acnOrgId: true },
    });
    if (!column) return notFoundJson("Column not found");
    if (!column.acnOrgId) {
      return badRequest(`Column ${slug} has no bound ACN Org`);
    }
    if (orgId && orgId !== column.acnOrgId) {
      return badRequest("acnOrgId does not match the column's Org");
    }
    return {
      acnOrgId: column.acnOrgId,
      columnId: column.id,
      columnSlug: column.slug,
    };
  }

  return { acnOrgId: orgId!, columnId: null, columnSlug: null };
}

/** Mark local join-request row approved after a successful ACN add (or already-member). */
export async function syncJoinRequestApproved(args: {
  acnOrgId: string;
  agentId: string;
  columnId?: string | null;
}): Promise<void> {
  await prisma.orgJoinRequest.upsert({
    where: {
      acnOrgId_agentId: {
        acnOrgId: args.acnOrgId,
        agentId: args.agentId,
      },
    },
    create: {
      acnOrgId: args.acnOrgId,
      agentId: args.agentId,
      columnId: args.columnId ?? null,
      status: "approved",
      decidedAt: new Date(),
    },
    update: {
      status: "approved",
      decidedAt: new Date(),
      ...(args.columnId !== undefined ? { columnId: args.columnId } : {}),
    },
  });
}

/** Clear local join-request after member removed so agent can re-apply cleanly. */
export async function syncJoinRequestRemoved(args: {
  acnOrgId: string;
  agentId: string;
}): Promise<void> {
  await prisma.orgJoinRequest.deleteMany({
    where: { acnOrgId: args.acnOrgId, agentId: args.agentId },
  });
}

export async function approveJoinRequest(args: {
  requestId: string;
  /** Path orgId — validated before any ACN side effect */
  expectedOrgId: string;
  role?: string;
}): Promise<
  | {
      request: {
        id: string;
        acnOrgId: string;
        agentId: string;
        status: string;
        columnId: string | null;
        decisionNote: string | null;
      };
      member: Awaited<ReturnType<typeof addAcnOrgMember>>;
    }
  | Response
> {
  if (!acnOrgConfigured()) {
    return badRequest("ACN Org is not configured on server");
  }

  const expectedOrgId = args.expectedOrgId.trim();
  const row = await prisma.orgJoinRequest.findUnique({
    where: { id: args.requestId },
  });
  if (!row || row.acnOrgId !== expectedOrgId) {
    return notFoundJson("Join request not found");
  }
  if (row.status === "approved") {
    return conflict("Join request already approved");
  }
  if (row.status !== "pending") {
    return badRequest("Join request was rejected; agent must request again");
  }

  try {
    const already = await isAgentOrgMember(row.acnOrgId, row.agentId);
    let member: Awaited<ReturnType<typeof addAcnOrgMember>>;
    if (already) {
      member = {
        org_id: row.acnOrgId,
        agent_id: row.agentId,
        role: args.role ?? "worker",
        status: "active",
      };
    } else {
      member = await addAcnOrgMember({
        orgId: row.acnOrgId,
        agentId: row.agentId,
        role: args.role ?? "worker",
      });
    }

    const updated = await prisma.orgJoinRequest.updateMany({
      where: { id: row.id, status: "pending" },
      data: { status: "approved", decidedAt: new Date() },
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
        columnId: true,
        decisionNote: true,
      },
    });
    return { request, member };
  } catch (err) {
    console.error("[orgJoin] approve failed", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already_member") || msg.includes("already in org")) {
      const updated = await prisma.orgJoinRequest.updateMany({
        where: { id: row.id, status: "pending" },
        data: { status: "approved", decidedAt: new Date() },
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
          columnId: true,
          decisionNote: true,
        },
      });
      return {
        request,
        member: {
          org_id: row.acnOrgId,
          agent_id: row.agentId,
          role: args.role ?? "worker",
          status: "active",
        },
      };
    }
    return serverError(`Failed to add ACN Org member: ${msg}`);
  }
}

export async function requestOrgJoin(args: {
  target: ResolvedOrgTarget;
  agentId: string;
  note?: string | null;
}): Promise<Response | Record<string, unknown>> {
  if (!acnOrgConfigured()) {
    return badRequest("ACN Org is not configured on server");
  }

  const agentId = args.agentId.trim();
  if (!agentId) return badRequest("agentId is required");

  try {
    const org = await getAcnOrg(args.target.acnOrgId);
    if (!org) return notFoundJson("ACN Org not found");

    if (await isAgentOrgMember(args.target.acnOrgId, agentId)) {
      return {
        status: "already_member",
        acnOrgId: args.target.acnOrgId,
        agentId,
        columnSlug: args.target.columnSlug,
      };
    }

    const policy = orgJoinPolicy(org);
    const existing = await prisma.orgJoinRequest.findUnique({
      where: {
        acnOrgId_agentId: {
          acnOrgId: args.target.acnOrgId,
          agentId,
        },
      },
    });

    if (existing?.status === "pending" && policy === "approval") {
      return {
        status: "pending",
        requestId: existing.id,
        acnOrgId: args.target.acnOrgId,
        agentId,
        columnSlug: args.target.columnSlug,
        joinPolicy: policy,
      };
    }

    if (policy === "open") {
      try {
        await addAcnOrgMember({
          orgId: args.target.acnOrgId,
          agentId,
          role: "worker",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("already_member") && !msg.includes("already in org")) {
          throw err;
        }
      }
      await syncJoinRequestApproved({
        acnOrgId: args.target.acnOrgId,
        agentId,
        columnId: args.target.columnId,
      });
      if (args.note?.trim()) {
        await prisma.orgJoinRequest.update({
          where: {
            acnOrgId_agentId: {
              acnOrgId: args.target.acnOrgId,
              agentId,
            },
          },
          data: { note: args.note.trim() },
        });
      }
      return {
        status: "joined",
        acnOrgId: args.target.acnOrgId,
        agentId,
        columnSlug: args.target.columnSlug,
        joinPolicy: policy,
      };
    }

    const row = await prisma.orgJoinRequest.upsert({
      where: {
        acnOrgId_agentId: {
          acnOrgId: args.target.acnOrgId,
          agentId,
        },
      },
      create: {
        acnOrgId: args.target.acnOrgId,
        agentId,
        columnId: args.target.columnId,
        status: "pending",
        note: args.note?.trim() || null,
      },
      update: {
        columnId: args.target.columnId ?? undefined,
        status: "pending",
        note: args.note?.trim() || undefined,
        decidedAt: null,
        decisionNote: null,
      },
    });

    return {
      status: "pending",
      requestId: row.id,
      acnOrgId: args.target.acnOrgId,
      agentId,
      columnSlug: args.target.columnSlug,
      joinPolicy: policy,
    };
  } catch (err) {
    console.error("[orgJoin] request failed", err);
    const msg = err instanceof Error ? err.message : String(err);
    return serverError(`Org join failed: ${msg}`);
  }
}
