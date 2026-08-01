import { prisma } from "@/lib/db";
import {
  getAssetRegistration,
  registerAsset,
  relistAssetListing,
  revokeAsset,
  storeConfigured,
  unlistAssetListing,
  upsertAssetListing,
} from "@/lib/agentplanet";
import type { AssetOwner } from "@/lib/assetRegistry";

/**
 * Move a character's registration from its own id onto its backing asset.
 *
 * Before the cutover a paid character was registered as
 * `comiclaw:character:{AgentCharacter.id}`; the subject is now
 * `comiclaw:character:{Asset.id}`. One namespace cannot hold two id spaces.
 *
 * Order of operations — deliberately not AgentPlanet's suggested
 * "revoke old → register new":
 *
 *   1. unlist the old product   stop sales before the subject moves, so nobody
 *                               buys something we are about to deregister
 *   2. register the new ref     if this fails, put the old product back and
 *                               stop — never leave a character unsellable
 *   3. revoke the old ref       only once the new one exists, so the character
 *                               is never unregistered
 *   4. list under the new ref   and write the product id back
 *
 * Revoke-first leaves a window with no registration at all, and under
 * `store_asset_registry_enforce` an order landing there is refused.
 *
 * Every character is probed against the live registry rather than a local
 * flag, so this is re-runnable and resumes a half-finished move.
 */

export type RefMigrationPlan = {
  characterId: string;
  name: string;
  licensePoints: number;
  ownerType: string;
  ownerId: string;
  oldRegistered: boolean;
  newRegistered: boolean;
  oldProductId: string | null;
  newProductId: string | null;
  /** move = the whole thing; resume = registration already moved, listing did not */
  action: "move" | "resume";
};

export type RefMigrationResult = {
  characterId: string;
  name: string;
  ok: boolean;
  message: string;
};

type Candidate = {
  id: string;
  name: string;
  tagline: string | null;
  imageUrl: string;
  assetId: string | null;
  acnAgentId: string | null;
  licensePoints: number;
  storeProductId: string | null;
};

async function candidates(): Promise<Candidate[]> {
  return prisma.agentCharacter.findMany({
    where: { assetId: { not: null } },
    select: {
      id: true,
      name: true,
      tagline: true,
      imageUrl: true,
      assetId: true,
      acnAgentId: true,
      licensePoints: true,
      storeProductId: true,
    },
  });
}

/** Read-only: what would move, straight from the live registry. */
export async function planCharacterRefMigration(): Promise<{
  configured: boolean;
  total: number;
  plans: RefMigrationPlan[];
}> {
  if (!storeConfigured()) return { configured: false, total: 0, plans: [] };

  const rows = await candidates();
  const plans: RefMigrationPlan[] = [];

  for (const c of rows) {
    const assetId = c.assetId!;
    const [oldReg, newReg, asset] = await Promise.all([
      getAssetRegistration("character", c.id),
      getAssetRegistration("character", assetId),
      prisma.asset.findUnique({
        where: { id: assetId },
        select: { storeProductId: true },
      }),
    ]);

    // A run that died after step 3 leaves no old registration to find, but the
    // job is not done: the character is priced, the new ref exists and nothing
    // is on sale. Resuming has to be driven by that state, not by whether the
    // old ref is still there, or those characters stay unsellable for good.
    const needsMove = Boolean(oldReg);
    const needsListing =
      Boolean(newReg) && c.licensePoints > 0 && !asset?.storeProductId;
    if (!needsMove && !needsListing) continue;

    const source = oldReg ?? newReg!;
    plans.push({
      characterId: c.id,
      name: c.name,
      licensePoints: c.licensePoints,
      ownerType: source.owner_type,
      ownerId: source.owner_id,
      oldRegistered: Boolean(oldReg),
      newRegistered: Boolean(newReg),
      oldProductId: c.storeProductId,
      newProductId: asset?.storeProductId ?? null,
      action: needsMove ? "move" : "resume",
    });
  }

  return { configured: true, total: rows.length, plans };
}

/** Do the move for one character. Safe to call again on a partial result. */
export async function migrateCharacterRef(
  characterId: string
): Promise<RefMigrationResult> {
  const c = await prisma.agentCharacter.findUnique({
    where: { id: characterId },
    select: {
      id: true,
      name: true,
      tagline: true,
      imageUrl: true,
      assetId: true,
      acnAgentId: true,
      licensePoints: true,
      storeProductId: true,
    },
  });
  const fail = (message: string): RefMigrationResult => ({
    characterId,
    name: c?.name ?? characterId,
    ok: false,
    message,
  });

  if (!c) return fail("角色不存在");
  if (!c.assetId) return fail("角色还没有背后的资产");
  const assetId = c.assetId;

  const [oldReg, newReg, asset] = await Promise.all([
    getAssetRegistration("character", c.id),
    getAssetRegistration("character", assetId),
    prisma.asset.findUnique({
      where: { id: assetId },
      select: { storeProductId: true },
    }),
  ]);

  const needsMove = Boolean(oldReg);
  const needsListing =
    Boolean(newReg) && c.licensePoints > 0 && !asset?.storeProductId;
  if (!needsMove && !needsListing) {
    return { characterId, name: c.name, ok: true, message: "无需处理" };
  }

  const source = oldReg ?? newReg!;
  const owner: AssetOwner = {
    type: source.owner_type as AssetOwner["type"],
    id: source.owner_id,
  };

  // 1. stop sales under the old subject
  if (needsMove && c.storeProductId) {
    await unlistAssetListing(c.storeProductId, owner.id);
  }

  // 2. new registration first — no window without one
  if (!newReg) {
    const reg = await registerAsset({
      kind: "character",
      localId: assetId,
      owner,
      displayName: c.name,
      boundAgentId: c.acnAgentId,
    });
    if (reg === "failed") {
      if (c.storeProductId) await relistAssetListing(c.storeProductId, owner.id);
      return fail("新 ref 登记失败，已把旧商品放回在售");
    }
  }

  // 3. retire the old subject
  if (oldReg) {
    const revoked = await revokeAsset("character", c.id);
    if (!revoked) {
      return fail("旧 ref 注销失败；新 ref 已登记，重跑会接着做");
    }
  }

  // 4. sell under the new subject
  if (c.licensePoints > 0) {
    const productId = await upsertAssetListing({
      // Never reuse the character's own product: it carries the old asset_ref,
      // so PATCHing it would relist the retired subject.
      storeProductId: asset?.storeProductId ?? null,
      kind: "character",
      localId: assetId,
      name: c.name,
      tagline: c.tagline,
      imageUrl: c.imageUrl,
      owner,
      credits: c.licensePoints,
    });
    if (!productId) {
      return fail("新 ref 上架失败：登记已迁好，重跑会补上架");
    }
    await prisma.agentCharacter.update({
      where: { id: c.id },
      data: { storeProductId: productId },
    });
    await prisma.asset.update({
      where: { id: assetId },
      data: {
        storeProductId: productId,
        licensePoints: c.licensePoints,
        ownerType: owner.type,
        ownerId: owner.id,
        publishState: "published",
        publishedAt: new Date(),
      },
    });
    return {
      characterId,
      name: c.name,
      ok: true,
      message: `已迁移，新商品 ${productId}`,
    };
  }

  // Once paid, now free: keep the registration, stay unlisted.
  await prisma.asset.update({
    where: { id: assetId },
    data: {
      ownerType: owner.type,
      ownerId: owner.id,
      publishState: "published",
      publishedAt: new Date(),
    },
  });
  return { characterId, name: c.name, ok: true, message: "已迁移（免费，保持不上架）" };
}

export async function runCharacterRefMigration(): Promise<RefMigrationResult[]> {
  const { plans } = await planCharacterRefMigration();
  const results: RefMigrationResult[] = [];
  for (const p of plans) {
    results.push(await migrateCharacterRef(p.characterId));
  }
  return results;
}
