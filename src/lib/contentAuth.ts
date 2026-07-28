import { forbidden } from "@/lib/auth";
import { LEGACY_AUTHOR_KEY, type ContentAuthor } from "@/lib/contentAuthor";

export type ContentAuthActor =
  | { kind: "user"; sub: string }
  | { kind: "acn_agent"; agentId: string }
  | { kind: "studio_key" };

export type MutableContent = Pick<
  ContentAuthor,
  "authorUserId" | "authorAgentId" | "authorKey"
>;

export type ContentProjectOwner = {
  ownerUserId: string | null;
  /** PRIVATE keeps classic studio/worker full access; PUBLIC is edit-own */
  visibility: string;
};

function isPublicProject(project: ContentProjectOwner): boolean {
  return project.visibility === "PUBLIC";
}

/**
 * Who may mutate (PATCH / add versions) content.
 * - PRIVATE: studio_key + task-bound workers + project owner (pre-open-project behavior)
 * - PUBLIC: edit-own only; studio_key has no blanket PATCH
 */
export function canMutateContent(
  content: MutableContent,
  project: ContentProjectOwner,
  actor: ContentAuthActor
): boolean {
  if (!isPublicProject(project)) {
    if (actor.kind === "studio_key") return true;
    if (actor.kind === "acn_agent") return true;
    if (actor.kind === "user") {
      return Boolean(project.ownerUserId && project.ownerUserId === actor.sub);
    }
    return false;
  }

  // PUBLIC — edit-own
  if (actor.kind === "user") {
    if (content.authorUserId && content.authorUserId === actor.sub) return true;
    if (
      content.authorKey === LEGACY_AUTHOR_KEY &&
      project.ownerUserId === actor.sub
    ) {
      return true;
    }
    return false;
  }

  if (actor.kind === "acn_agent") {
    return Boolean(
      content.authorAgentId && content.authorAgentId === actor.agentId
    );
  }

  // studio_key: no blanket PATCH on PUBLIC authored content
  if (content.authorKey === LEGACY_AUTHOR_KEY) return true;
  return false;
}

/** Ops may delete any content with studio_key; others need mutate rights. */
export function canDeleteContent(
  content: MutableContent,
  project: ContentProjectOwner,
  actor: ContentAuthActor
): boolean {
  if (actor.kind === "studio_key") return true;
  return canMutateContent(content, project, actor);
}

export function assertCanMutateContent(
  content: MutableContent,
  project: ContentProjectOwner,
  actor: ContentAuthActor
): Response | null {
  if (canMutateContent(content, project, actor)) return null;
  return forbidden("You can only edit your own content");
}

export function assertCanDeleteContent(
  content: MutableContent,
  project: ContentProjectOwner,
  actor: ContentAuthActor
): Response | null {
  if (canDeleteContent(content, project, actor)) return null;
  return forbidden("You can only delete your own content");
}

export function actorFromProductionAuth(
  auth:
    | { kind: "studio_key" }
    | { kind: "acn_worker"; agentId: string }
    | { kind: "acn_contributor"; agentId: string }
    | { kind: "acn_agent"; agentId: string }
): ContentAuthActor {
  if (auth.kind === "studio_key") return { kind: "studio_key" };
  return { kind: "acn_agent", agentId: auth.agentId };
}
