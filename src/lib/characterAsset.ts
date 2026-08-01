import { authorFromAgent, authorFromUser, LEGACY_AUTHOR_KEY } from "@/lib/contentAuthor";

/**
 * The Asset that backs a marketplace character.
 *
 * Characters and project assets have been two tradable subjects sharing one
 * `comiclaw:character:*` namespace — two id spaces under one prefix, which is
 * exactly the ambiguity AgentPlanet asked us to remove. The Asset becomes the
 * subject; the character row keeps what is character-specific (persona, the
 * agent that plays it, whether it is public).
 *
 * The backing asset starts as a plain draft: it is not registered, not priced
 * and not listed. Ownership only becomes real when the registration actually
 * moves, which is a separate, explicit step against live production data.
 */

export type CharacterForAsset = {
  name: string;
  tagline: string | null;
  imageUrl: string;
  audioUrl: string | null;
  ownerUserId: string | null;
  acnAgentId: string | null;
};

export type BackingAssetInput = {
  type: "CHARACTER";
  name: string;
  description: string | null;
  authorUserId: string | null;
  authorAgentId: string | null;
  authorKey: string;
  version: { imageUrl: string; audioUrl: string | null };
};

/**
 * Authorship follows the same rule as everywhere else: the human owner if we
 * have one, otherwise the agent that plays the character. A character with
 * neither predates authorship tracking and stays `legacy` — claimable by
 * nobody, which is the safe reading for something we cannot attribute.
 */
export function backingAssetInput(c: CharacterForAsset): BackingAssetInput {
  const author = c.ownerUserId
    ? authorFromUser(c.ownerUserId)
    : c.acnAgentId
      ? authorFromAgent(c.acnAgentId)
      : { authorUserId: null, authorAgentId: null, authorKey: LEGACY_AUTHOR_KEY };

  return {
    type: "CHARACTER",
    name: c.name,
    description: c.tagline,
    ...author,
    version: { imageUrl: c.imageUrl, audioUrl: c.audioUrl },
  };
}

/**
 * Whether the backing asset's artwork is out of date.
 *
 * A character's image can be replaced in place; an asset records takes. Rather
 * than overwrite the latest version, a changed image becomes a new one — the
 * pinned take a licensee bought stays what they bought.
 */
export function artworkChanged(
  latest: { imageUrl: string; audioUrl: string | null } | null,
  c: Pick<CharacterForAsset, "imageUrl" | "audioUrl">
): boolean {
  if (!latest) return true;
  return latest.imageUrl !== c.imageUrl || (latest.audioUrl ?? null) !== c.audioUrl;
}
