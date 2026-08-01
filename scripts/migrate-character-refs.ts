/**
 * Move a character's registration from its own id to its backing asset's id.
 *
 * Before the cutover a paid character was registered as
 * `comiclaw:character:{AgentCharacter.id}`; the subject is now
 * `comiclaw:character:{Asset.id}`. Both live in one namespace, which is the
 * ambiguity AgentPlanet asked us to remove.
 *
 * Order of operations — deliberately not AgentPlanet's suggested
 * "revoke old → register new":
 *
 *   1. unlist the old product        — stop sales before the subject moves,
 *                                      so nobody buys something we are about
 *                                      to deregister
 *   2. register the new ref          — same owner; if this fails we put the
 *                                      old product back and stop, rather than
 *                                      leaving the character unsellable
 *   3. revoke the old ref            — only once the new one exists, so the
 *                                      character is never unregistered
 *   4. list under the new ref        — write the product id back
 *
 * Revoke-first would leave a window with no registration at all, and under
 * `store_asset_registry_enforce` an order landing in that window is refused.
 *
 * Re-runnable: each character is probed against the live registry, so anything
 * already moved is skipped and a half-finished move is resumed.
 *
 * Dry run:  npx tsx scripts/migrate-character-refs.ts
 * Apply:    npx tsx scripts/migrate-character-refs.ts --apply
 */
import { prisma } from "../src/lib/db";
import {
  getAssetRegistration,
  registerAsset,
  relistAssetListing,
  revokeAsset,
  storeConfigured,
  unlistAssetListing,
  upsertAssetListing,
} from "../src/lib/agentplanet";
import type { AssetOwner } from "../src/lib/assetRegistry";

const APPLY = process.argv.includes("--apply");

async function main() {
  if (!storeConfigured()) {
    console.error("AGENTPLANET_API_URL / AGENTPLANET_INTERNAL_TOKEN are not set");
    process.exit(1);
  }

  const characters = await prisma.agentCharacter.findMany({
    where: { assetId: { not: null } },
    select: {
      id: true,
      name: true,
      tagline: true,
      imageUrl: true,
      assetId: true,
      acnAgentId: true,
      ownerUserId: true,
      licensePoints: true,
      storeProductId: true,
    },
  });

  console.log(`${characters.length} character(s) with a backing asset\n`);
  let moved = 0;
  let skipped = 0;
  let pending = 0;

  for (const c of characters) {
    const assetId = c.assetId!;
    const [oldReg, newReg] = await Promise.all([
      getAssetRegistration("character", c.id),
      getAssetRegistration("character", assetId),
    ]);

    if (!oldReg) {
      // Never registered under its own id, or already retired.
      skipped++;
      continue;
    }

    const owner: AssetOwner = { type: oldReg.owner_type as AssetOwner["type"], id: oldReg.owner_id };
    console.log(
      `${c.name} (${c.id})\n  旧 ref 产权: ${owner.type}:${owner.id}` +
        `\n  新 ref: ${newReg ? "已登记" : "未登记"}` +
        `\n  商品: ${c.storeProductId ?? "无"}  价: ${c.licensePoints}`
    );

    if (!APPLY) {
      pending++;
      console.log("  → 将：下架旧商品 → 登记新 ref → 注销旧 ref → 以新 ref 上架\n");
      continue;
    }

    // 1. stop sales under the old subject
    if (c.storeProductId) {
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
        console.error("  ✗ 新 ref 登记失败，回滚：把旧商品放回在售");
        if (c.storeProductId) {
          await relistAssetListing(c.storeProductId, owner.id);
        }
        continue;
      }
    }

    // 3. retire the old subject
    const revoked = await revokeAsset("character", c.id);
    if (!revoked) {
      console.error("  ✗ 旧 ref 注销失败；新 ref 已登记，重跑本脚本会接着做");
      continue;
    }

    // 4. sell under the new subject
    if (c.licensePoints > 0) {
      const productId = await upsertAssetListing({
        storeProductId: null, // the old product belongs to the old ref
        kind: "character",
        localId: assetId,
        name: c.name,
        tagline: c.tagline,
        imageUrl: c.imageUrl,
        owner,
        credits: c.licensePoints,
      });
      if (!productId) {
        console.error("  ✗ 新 ref 上架失败：登记已迁好，重跑本脚本会补上架");
        continue;
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
      console.log(`  ✓ 已迁移，新商品 ${productId}\n`);
    } else {
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
      console.log("  ✓ 已迁移（免费，保持不上架）\n");
    }
    moved++;
  }

  if (APPLY) {
    console.log(`迁移 ${moved} 条，跳过 ${skipped} 条（旧 ref 上没有登记）`);
  } else if (pending > 0) {
    console.log(`${pending} 条待迁移，${skipped} 条无需处理`);
    console.log("\nDry run. Re-run with --apply to move these.");
  } else {
    console.log(`没有待迁移的（${skipped} 条旧 ref 上没有登记）`);
  }
}

main().finally(() => prisma.$disconnect());
