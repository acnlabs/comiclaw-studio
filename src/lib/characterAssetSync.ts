import { prisma } from "@/lib/db";
import {
  artworkChanged,
  backingAssetInput,
  type CharacterForAsset,
} from "@/lib/characterAsset";

/**
 * Keep a character's backing Asset in step with the character.
 *
 * Without this the two drift and the cutover would register an asset under a
 * stale name or a stale picture. Failures are swallowed: a character must
 * still be creatable when this bookkeeping cannot complete, and the backfill
 * script picks up whatever was missed.
 */

export async function ensureBackingAsset(characterId: string): Promise<string | null> {
  const character = await prisma.agentCharacter.findUnique({
    where: { id: characterId },
    select: {
      id: true,
      assetId: true,
      name: true,
      tagline: true,
      imageUrl: true,
      audioUrl: true,
      ownerUserId: true,
      acnAgentId: true,
    },
  });
  if (!character) return null;
  if (character.assetId) return character.assetId;

  const input = backingAssetInput(character as CharacterForAsset);
  const asset = await prisma.asset.create({
    data: {
      projectId: null,
      type: input.type,
      name: input.name,
      description: input.description,
      authorUserId: input.authorUserId,
      authorAgentId: input.authorAgentId,
      authorKey: input.authorKey,
      versions: { create: { version: 1, ...input.version } },
    },
    select: { id: true },
  });
  await prisma.agentCharacter.update({
    where: { id: character.id },
    data: { assetId: asset.id },
  });
  return asset.id;
}

/** Mirror a character edit onto its backing asset; new artwork becomes a new take. */
export async function syncBackingAsset(characterId: string): Promise<void> {
  const character = await prisma.agentCharacter.findUnique({
    where: { id: characterId },
    select: {
      assetId: true,
      name: true,
      tagline: true,
      imageUrl: true,
      audioUrl: true,
      asset: {
        select: {
          id: true,
          versions: {
            orderBy: { version: "desc" },
            take: 1,
            select: { version: true, imageUrl: true, audioUrl: true },
          },
        },
      },
    },
  });
  if (!character?.asset) return;

  await prisma.asset.update({
    where: { id: character.asset.id },
    data: { name: character.name, description: character.tagline },
  });

  const latest = character.asset.versions[0] ?? null;
  if (artworkChanged(latest, character)) {
    await prisma.assetVersion.create({
      data: {
        assetId: character.asset.id,
        version: (latest?.version ?? 0) + 1,
        imageUrl: character.imageUrl,
        audioUrl: character.audioUrl,
      },
    });
  }
}

/** Best-effort wrapper: character writes must not fail on bookkeeping. */
export async function trackCharacterAsset(
  characterId: string,
  mode: "create" | "update"
): Promise<void> {
  try {
    const assetId = await ensureBackingAsset(characterId);
    if (mode === "update" && assetId) await syncBackingAsset(characterId);
  } catch (err) {
    console.error("[characterAsset] failed to track backing asset", characterId, err);
  }
}
