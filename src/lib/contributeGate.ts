import { extractBearer } from "@/lib/auth";
import type { ProductionAuth } from "@/lib/acnAuth";
import type { ContentAuthor } from "@/lib/contentAuthor";
import { assertAgentCanContribute } from "@/lib/orgBinding";

/** Run Org membership gate after authorship is resolved for agent/worker creates. */
export async function gateAgentContentCreate(args: {
  req: Request;
  auth: ProductionAuth;
  projectId: string;
  projectVisibility: string;
  author: ContentAuthor;
}): Promise<Response | null> {
  const agentId =
    args.author.authorAgentId ??
    (args.auth.kind === "acn_worker" ? args.auth.agentId : null);

  return assertAgentCanContribute({
    projectId: args.projectId,
    projectVisibility: args.projectVisibility,
    agentId,
    isStudioKey: args.auth.kind === "studio_key",
    bearer:
      args.auth.kind === "acn_worker"
        ? extractBearer(args.req) ?? undefined
        : undefined,
  });
}
