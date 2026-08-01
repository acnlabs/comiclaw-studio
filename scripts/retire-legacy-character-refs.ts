/**
 * Retire the registrations that still point at a character's own id.
 *
 * The registry subject is now the character's backing asset
 * (`comiclaw:character:{Asset.id}`), so the old entries
 * (`comiclaw:character:{AgentCharacter.id}`) are leftovers. Nothing is being
 * preserved here: none of them are on sale, and a character that is still
 * priced re-registers under the new subject the next time its listing syncs
 * (any price edit does it).
 *
 * That is why this is a dozen lines and not a migration: the data is test data.
 * If it were real inventory with live orders, retiring a registration before
 * the replacement existed would be the wrong order of operations — see the
 * repo history for the version that worried about that.
 *
 * Dry run:  npx tsx scripts/retire-legacy-character-refs.ts
 * Apply:    npx tsx scripts/retire-legacy-character-refs.ts --apply
 */
import { prisma } from "../src/lib/db";
import {
  getAssetRegistration,
  revokeAsset,
  storeConfigured,
  unlistAssetListing,
} from "../src/lib/agentplanet";

const APPLY = process.argv.includes("--apply");

async function main() {
  if (!storeConfigured()) {
    console.error("AGENTPLANET_API_URL / AGENTPLANET_INTERNAL_TOKEN are not set");
    process.exit(1);
  }

  const characters = await prisma.agentCharacter.findMany({
    select: { id: true, name: true, storeProductId: true, licensePoints: true },
  });

  let found = 0;
  for (const c of characters) {
    const stale = await getAssetRegistration("character", c.id);
    if (!stale) continue;
    found++;

    const owner = `${stale.owner_type}:${stale.owner_id}`;
    if (!APPLY) {
      console.log(
        `· ${c.name} (${c.id}) — 旧 ref 仍在登记，产权 ${owner}` +
          (c.storeProductId ? `，旧商品 ${c.storeProductId}` : "") +
          (c.licensePoints > 0 ? `，价 ${c.licensePoints}（改价即会按新 ref 重新登记上架）` : "")
      );
      continue;
    }

    // Take the old product down with it, otherwise it advertises a subject
    // that no longer exists.
    if (c.storeProductId) {
      await unlistAssetListing(c.storeProductId, stale.owner_id);
    }
    const ok = await revokeAsset("character", c.id);
    console.log(`${ok ? "✓" : "✗"} ${c.name} (${c.id}) — 旧 ref ${ok ? "已注销" : "注销失败"}`);
  }

  if (found === 0) {
    console.log("没有指向角色 id 的旧登记。");
  } else if (!APPLY) {
    console.log(`\n${found} 条旧登记。加 --apply 注销。`);
  }
}

main().finally(() => prisma.$disconnect());
