import type { AssetOwner, RegisterAssetArgs } from "@/lib/assetRegistry";

/**
 * Who a published film belongs to on the registry, and which agent Launch
 * should show it under. Pure so it can be checked without AgentPlanet or a DB.
 *
 * The appearing agent wins: ComicLaw only produced the cut. Owner follows
 * that agent when we know it, otherwise the film author, the publishing
 * agent, or the project owner.
 */

export type VideoRegistrySubject = {
  owner: AssetOwner;
  boundAgentId: string | null;
};

function trimId(value: string | null | undefined): string | null {
  const id = value?.trim();
  return id || null;
}

export function resolveVideoRegistrySubject(args: {
  appearingAgentId?: string | null;
  publisherAgentId?: string | null;
  filmAuthorAgentId?: string | null;
  projectOwnerUserId?: string | null;
}): VideoRegistrySubject | null {
  const appearing = trimId(args.appearingAgentId);
  const publisher = trimId(args.publisherAgentId);
  const filmAuthor = trimId(args.filmAuthorAgentId);
  const user = trimId(args.projectOwnerUserId);
  const boundAgentId = appearing || publisher || filmAuthor;

  if (appearing) return { owner: { type: "agent", id: appearing }, boundAgentId };
  if (filmAuthor) return { owner: { type: "agent", id: filmAuthor }, boundAgentId };
  if (publisher) return { owner: { type: "agent", id: publisher }, boundAgentId };
  if (user) return { owner: { type: "user", id: user }, boundAgentId: null };
  return null;
}

export function videoRegisterArgs(args: {
  workId: string;
  displayName: string;
  subject: VideoRegistrySubject;
}): RegisterAssetArgs {
  return {
    kind: "video",
    localId: args.workId,
    owner: args.subject.owner,
    displayName: args.displayName,
    boundAgentId: args.subject.boundAgentId,
  };
}
