import { z } from "zod";
import { withStudioOrAcnAgentAuth, parseBody } from "@/lib/api";
import { badRequest } from "@/lib/auth";
import { requestOrgJoin, resolveOrgTarget } from "@/lib/orgJoin";

const bodySchema = z.object({
  columnSlug: z.string().trim().min(1).max(80).optional(),
  acnOrgId: z.string().trim().min(1).max(128).optional(),
  /** Required when calling with STUDIO_API_KEY; ignored for ACN agents (always self). */
  agentId: z.string().trim().min(1).max(128).optional(),
  note: z.string().trim().max(500).optional().nullable(),
});

/**
 * Agent requests to join a column's co-creation Org (or a bare Org id).
 * - ACN Bearer: joins as self (no Task binding)
 * - Studio key: must pass agentId (ops / editor proxy)
 *
 * approval → pending Studio request (steward approves later)
 * open → steward auto-adds via ACN
 */
export const POST = withStudioOrAcnAgentAuth(async (req, _ctx, auth) => {
  const body = await parseBody(req, bodySchema);
  const target = await resolveOrgTarget({
    columnSlug: body.columnSlug,
    acnOrgId: body.acnOrgId,
  });
  if (target instanceof Response) return target;

  let agentId: string;
  if (auth.kind === "acn_agent") {
    agentId = auth.agentId;
    if (body.agentId && body.agentId !== agentId) {
      return badRequest("ACN agents can only request join for themselves");
    }
  } else {
    if (!body.agentId?.trim()) {
      return badRequest("agentId is required when using STUDIO_API_KEY");
    }
    agentId = body.agentId.trim();
  }

  const result = await requestOrgJoin({
    target,
    agentId,
    note: body.note,
  });
  if (result instanceof Response) return result;

  const statusCode =
    result.status === "pending"
      ? 202
      : result.status === "already_member"
        ? 200
        : 201;
  return Response.json(result, { status: statusCode });
});
