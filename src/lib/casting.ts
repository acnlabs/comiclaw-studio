import { prisma } from "@/lib/db";
import { ensureBackingAsset } from "@/lib/characterAssetSync";
import {
  grantAssetLicense,
  reconcilePendingAssetLicenses,
} from "@/lib/assetLicenseGrant";
import type { AgentCharacter, AssetLicense } from "@prisma/client";

/**
 * Casting a marketplace character into a project is an asset licence on that
 * character's backing asset.
 *
 * It used to have its own table with the same columns and the same money, and
 * two tables of one shape had already let the paid path drift once. What is
 * left here is the character-shaped edge: resolving the subject, and saying
 * where the copy came from.
 */

const CAST_NOTE = "来自角色市场授权 / Licensed from Cast";

/** The character's tradable subject, minted on demand if it is somehow missing. */
export async function castingSubjectId(
  character: Pick<AgentCharacter, "id" | "assetId">
): Promise<string | null> {
  return character.assetId ?? (await ensureBackingAsset(character.id));
}

export async function grantLicense(args: {
  character: AgentCharacter;
  projectId: string;
  sub: string;
  points: number;
  orderId: string | null;
}): Promise<AssetLicense | null> {
  const { character, projectId, sub, points, orderId } = args;

  const assetId = await castingSubjectId(character);
  if (!assetId) {
    console.error("[casting] character has no backing asset", character.id);
    return null;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { visibility: true },
  });

  const granted = await grantAssetLicense({
    asset: {
      id: assetId,
      name: character.name,
      description:
        character.tagline ??
        (character.persona ? character.persona.slice(0, 200) : null),
      type: "CHARACTER",
    },
    projectId,
    projectVisibility: project?.visibility ?? "PRIVATE",
    sub,
    points,
    orderId,
    // Straight off the character: its backing asset mirrors artwork on a
    // best-effort hook, and a buyer who just paid should get what the
    // storefront showed them, not whatever the mirror last managed to write.
    artwork: { imageUrl: character.imageUrl, audioUrl: character.audioUrl },
    note: CAST_NOTE,
  });

  if (!granted.ok) {
    console.error("[casting] grant refused", character.id, granted.reason);
    return null;
  }
  return granted.license;
}

/**
 * Lazy self-healing for buyers who paid and never came back. Character and
 * project assets share one reconciler now, so a fix to either reaches both.
 */
export async function reconcilePendingLicenses(sub: string): Promise<void> {
  await reconcilePendingAssetLicenses(sub);
}
