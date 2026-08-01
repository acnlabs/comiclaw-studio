import { prisma } from "@/lib/db";
import { withRetry } from "@/lib/api";
import { PUBLISH_DRAFT } from "@/lib/assetPublish";
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

  // Two concurrent callers can both see a null assetId. Only the one that
  // actually claims the slot keeps its asset; the loser cleans up after
  // itself rather than leaving a stray standalone asset behind.
  const claimed = await prisma.agentCharacter.updateMany({
    where: { id: character.id, assetId: null },
    data: { assetId: asset.id },
  });
  if (claimed.count === 0) {
    await prisma.asset.delete({ where: { id: asset.id } }).catch(() => {});
    const winner = await prisma.agentCharacter.findUnique({
      where: { id: character.id },
      select: { assetId: true },
    });
    return winner?.assetId ?? null;
  }
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
  if (!artworkChanged(latest, character)) return;

  const assetId = character.asset.id;
  // Version numbers are unique per asset, so a concurrent take has to be
  // renumbered rather than lost.
  await withRetry(async () => {
    const head = await prisma.assetVersion.findFirst({
      where: { assetId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    await prisma.assetVersion.create({
      data: {
        assetId,
        version: (head?.version ?? 0) + 1,
        imageUrl: character.imageUrl,
        audioUrl: character.audioUrl,
      },
    });
  });
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

/**
 * A character's backing asset goes with it.
 *
 * The FK only nulls the link, so without this the asset lingers as a
 * standalone draft that nobody recognises. Licensed or registered assets are
 * left alone and reported: those are commitments to other people, and the
 * character delete path already refuses to strand a registration.
 */
export async function deleteBackingAsset(assetId: string | null): Promise<void> {
  if (!assetId) return;
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      publishState: true,
      _count: { select: { licenses: true, shotRefs: true } },
    },
  });
  if (!asset) return;
  if (asset.publishState !== PUBLISH_DRAFT || asset._count.licenses > 0) {
    console.error(
      "[characterAsset] backing asset kept: still registered or licensed",
      assetId
    );
    return;
  }
  await prisma.asset.delete({ where: { id: assetId } }).catch((err) => {
    console.error("[characterAsset] failed to delete backing asset", assetId, err);
  });
}
