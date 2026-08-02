/**
 * Retire registry entries that still point at a character's own id.
 *
 * The registry subject is now the character's backing asset
 * (`comiclaw:character:{Asset.id}`), so entries keyed by
 * `comiclaw:character:{AgentCharacter.id}` are leftovers from before the
 * cutover. Two of them left alone would be worse than untidy: if such an entry
 * still has a store product attached, someone can pay for a subject Studio no
 * longer honours.
 *
 * Reading the plan needs the same credentials as applying it, which is why this
 * runs on the server rather than from a laptop holding production secrets.
 */
import { prisma } from "@/lib/db";
import {
  getAssetRegistration,
  revokeAsset,
  storeConfigured,
  unlistAssetListing,
} from "@/lib/agentplanet";

export type StaleRef = {
  characterId: string;
  name: string;
  owner: string;
  storeProductId: string | null;
  licensePoints: number;
};

export type RetireOutcome = StaleRef & { revoked: boolean; unlisted: boolean | null };

export function retireConfigured(): boolean {
  return storeConfigured();
}

export async function planRetirement(): Promise<StaleRef[]> {
  const characters = await prisma.agentCharacter.findMany({
    select: { id: true, name: true, storeProductId: true, licensePoints: true },
  });

  const stale: StaleRef[] = [];
  for (const c of characters) {
    const found = await getAssetRegistration("character", c.id);
    if (!found) continue;
    stale.push({
      characterId: c.id,
      name: c.name,
      owner: `${found.owner_type}:${found.owner_id}`,
      storeProductId: c.storeProductId,
      licensePoints: c.licensePoints,
    });
  }
  return stale;
}

export async function runRetirement(): Promise<RetireOutcome[]> {
  const stale = await planRetirement();
  const results: RetireOutcome[] = [];

  for (const ref of stale) {
    // Take the product down first: a live listing advertising a subject we are
    // about to revoke is the one state that can take someone's money for
    // nothing.
    let unlisted: boolean | null = null;
    if (ref.storeProductId) {
      const sellerId = ref.owner.split(":").slice(1).join(":");
      unlisted = await unlistAssetListing(ref.storeProductId, sellerId);
      if (!unlisted) {
        results.push({ ...ref, unlisted, revoked: false });
        continue;
      }
    }
    const revoked = await revokeAsset("character", ref.characterId);
    results.push({ ...ref, unlisted, revoked });
  }

  return results;
}
