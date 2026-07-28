import { extractBearer } from "@/lib/auth";
import { productionAgentId, type ProductionAuth } from "@/lib/acnAuth";
import type { ContentAuthor } from "@/lib/contentAuthor";
import { assertAgentCanContribute } from "@/lib/orgBinding";

/**
 * Org / contributePolicy gate for agent/worker **creates** (and callers that mint URLs).
 * Mutate/delete on PUBLIC stays edit-own only — do not call this there.
 */
export async function gateAgentContentCreate(args: {
  req: Request;
  auth: ProductionAuth;
  projectId: string;
  projectVisibility: string;
  author: ContentAuthor;
}): Promise<Response | null> {
  const agentId =
    args.author.authorAgentId ?? productionAgentId(args.auth);

  const isAcn =
    args.auth.kind === "acn_worker" || args.auth.kind === "acn_contributor";

  return assertAgentCanContribute({
    projectId: args.projectId,
    projectVisibility: args.projectVisibility,
    agentId,
    isStudioKey: args.auth.kind === "studio_key",
    bearer: isAcn ? extractBearer(args.req) ?? undefined : undefined,
  });
}
