import { z } from "zod";
import { withAgentAuth, parseBody } from "@/lib/api";
import { badRequest, notFoundJson, serverError } from "@/lib/auth";
import {
  acnOrgConfigured,
  addAcnOrgMember,
  listAcnOrgMembers,
  removeAcnOrgMember,
} from "@/lib/acnOrg";
import {
  syncJoinRequestApproved,
  syncJoinRequestRemoved,
} from "@/lib/orgJoin";

type Ctx = { params: Promise<{ orgId: string }> };

const addSchema = z.object({
  agentId: z.string().trim().min(1).max(128),
  role: z.string().trim().min(1).max(40).optional(),
});

/** List Org members (Studio key). */
export const GET = withAgentAuth(async (_req, ctx: Ctx) => {
  const { orgId: raw } = await ctx.params;
  const orgId = raw?.trim();
  if (!orgId) return notFoundJson();
  if (!acnOrgConfigured()) {
    return badRequest("ACN Org is not configured on server");
  }
  try {
    const members = await listAcnOrgMembers(orgId);
    return Response.json({ acnOrgId: orgId, members });
  } catch (err) {
    console.error("[orgs/members] list failed", err);
    return serverError("Failed to list ACN Org members");
  }
});

/** Direct-add member via steward (Studio key) — also syncs local join-request row. */
export const POST = withAgentAuth(async (req, ctx: Ctx) => {
  const { orgId: raw } = await ctx.params;
  const orgId = raw?.trim();
  if (!orgId) return notFoundJson();
  if (!acnOrgConfigured()) {
    return badRequest("ACN Org is not configured on server");
  }
  const body = await parseBody(req, addSchema);
  try {
    const member = await addAcnOrgMember({
      orgId,
      agentId: body.agentId,
      role: body.role,
    });
    await syncJoinRequestApproved({
      acnOrgId: orgId,
      agentId: body.agentId,
    });
    return Response.json({ member }, { status: 201 });
  } catch (err) {
    console.error("[orgs/members] add failed", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already_member") || msg.includes("already in org")) {
      await syncJoinRequestApproved({
        acnOrgId: orgId,
        agentId: body.agentId,
      });
      return Response.json(
        {
          member: {
            org_id: orgId,
            agent_id: body.agentId,
            role: body.role ?? "worker",
            status: "active",
          },
          status: "already_member",
        },
        { status: 200 }
      );
    }
    return badRequest(`Failed to add member: ${msg}`);
  }
});

/** Remove member (Studio key). Use ?agentId= — clears local join-request so agent can re-apply. */
export const DELETE = withAgentAuth(async (req, ctx: Ctx) => {
  const { orgId: raw } = await ctx.params;
  const orgId = raw?.trim();
  if (!orgId) return notFoundJson();
  if (!acnOrgConfigured()) {
    return badRequest("ACN Org is not configured on server");
  }
  const agentId = new URL(req.url).searchParams.get("agentId")?.trim();
  if (!agentId) return badRequest("agentId query param is required");
  try {
    await removeAcnOrgMember({ orgId, agentId });
    await syncJoinRequestRemoved({ acnOrgId: orgId, agentId });
    return Response.json({ deleted: true, acnOrgId: orgId, agentId });
  } catch (err) {
    console.error("[orgs/members] remove failed", err);
    const msg = err instanceof Error ? err.message : String(err);
    return badRequest(`Failed to remove member: ${msg}`);
  }
});
