import { badRequest } from "@/lib/auth";
import type { ProductionAuth } from "@/lib/acnAuth";

export const LEGACY_AUTHOR_KEY = "legacy";

export type ContentAuthor = {
  authorUserId: string | null;
  authorAgentId: string | null;
  authorKey: string;
};

export function userAuthorKey(sub: string): string {
  return `user:${sub}`;
}

export function agentAuthorKey(agentId: string): string {
  return `agent:${agentId}`;
}

export function authorFromUser(sub: string): ContentAuthor {
  return {
    authorUserId: sub,
    authorAgentId: null,
    authorKey: userAuthorKey(sub),
  };
}

export function authorFromAgent(agentId: string): ContentAuthor {
  return {
    authorUserId: null,
    authorAgentId: agentId,
    authorKey: agentAuthorKey(agentId),
  };
}

/** Resolve author for agent/worker content creation. */
export function resolveAgentCreateAuthor(args: {
  auth: ProductionAuth;
  visibility: string;
  authorUserId?: string | null;
  authorAgentId?: string | null;
}): ContentAuthor | Response {
  const { auth, visibility } = args;
  const explicitUser = args.authorUserId?.trim() || null;
  const explicitAgent = args.authorAgentId?.trim() || null;

  if (explicitUser && explicitAgent) {
    return badRequest("Provide only one of authorUserId or authorAgentId");
  }

  if (auth.kind === "acn_worker" || auth.kind === "acn_contributor") {
    // ACN callers always sign as themselves; ignore forged authorAgentId for other agents
    if (explicitUser) {
      return badRequest("ACN agents cannot attribute content to a human user");
    }
    if (explicitAgent && explicitAgent !== auth.agentId) {
      return badRequest("ACN agents cannot attribute content to another agent");
    }
    return authorFromAgent(auth.agentId);
  }

  // studio_key: must explicitly sign as user or agent for PUBLIC; PRIVATE may stay legacy
  if (explicitUser) return authorFromUser(explicitUser);
  if (explicitAgent) return authorFromAgent(explicitAgent);

  if (visibility === "PUBLIC") {
    return badRequest(
      "PUBLIC projects require authorUserId or authorAgentId when creating with studio key"
    );
  }

  return {
    authorUserId: null,
    authorAgentId: null,
    authorKey: LEGACY_AUTHOR_KEY,
  };
}
