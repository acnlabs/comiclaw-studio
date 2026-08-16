import { forbidden, serverError } from "@/lib/auth";
import { isAgentOrgMember } from "@/lib/acnOrg";
import {
  createOwnerAssignmentError,
  type OwnerActor,
  type ProjectOwner,
} from "@/lib/owner";

/** 创建时校验东家:Studio key 全权;agent 不能挂别人的 agent,挂组织须是成员。 */
export async function assertCreateOwnerAllowed(args: {
  owner: ProjectOwner;
  actor: OwnerActor;
  bearer?: string;
  allowedOrgIds?: string[];
}): Promise<Response | null> {
  const denied = createOwnerAssignmentError(args.owner, args.actor, {
    allowedOrgIds: args.allowedOrgIds,
  });
  if (!denied) return null;
  if (denied !== "ORG_MEMBERSHIP_REQUIRED") return forbidden(denied);

  const orgId = args.owner.ownerOrgId;
  if (args.actor.kind !== "agent" || !orgId) {
    return forbidden("An agent can only assign an Org it belongs to as owner");
  }
  try {
    const member = await isAgentOrgMember(orgId, args.actor.agentId, args.bearer);
    if (!member) {
      return forbidden("An agent can only assign an Org it belongs to as owner");
    }
    return null;
  } catch (err) {
    console.error("[ownerAuth] membership check failed", err);
    return serverError("Failed to verify ACN Org membership");
  }
}
