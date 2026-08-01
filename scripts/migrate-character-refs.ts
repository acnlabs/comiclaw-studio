/**
 * Command-line front end for the character registry cutover.
 *
 * The same thing is available in the browser at `/studio/character-refs`,
 * which is usually the better door: the production database and the
 * AgentPlanet token are already on the server there. This exists for when a
 * shell is what you have.
 *
 * The logic lives in `src/lib/characterRefMigration.ts` — one implementation,
 * so the button and the command cannot drift apart.
 *
 * Dry run:  npx tsx scripts/migrate-character-refs.ts
 * Apply:    npx tsx scripts/migrate-character-refs.ts --apply
 */
import { prisma } from "../src/lib/db";
import {
  migrateCharacterRef,
  planCharacterRefMigration,
} from "../src/lib/characterRefMigration";

const APPLY = process.argv.includes("--apply");

async function main() {
  const { configured, total, plans } = await planCharacterRefMigration();
  if (!configured) {
    console.error("AGENTPLANET_API_URL / AGENTPLANET_INTERNAL_TOKEN are not set");
    process.exit(1);
  }

  console.log(`${total} character(s) with a backing asset，${plans.length} 条待处理\n`);

  for (const p of plans) {
    console.log(
      `${p.name} (${p.characterId})\n  产权: ${p.ownerType}:${p.ownerId}` +
        `\n  旧 ref: ${p.oldRegistered ? "仍在登记" : "已注销"}` +
        `  新 ref: ${p.newRegistered ? "已登记" : "未登记"}` +
        `\n  旧商品: ${p.oldProductId ?? "无"}  新商品: ${p.newProductId ?? "无"}  价: ${p.licensePoints}`
    );

    if (!APPLY) {
      console.log(
        p.action === "move"
          ? "  → 将：下架旧商品 → 登记新 ref → 注销旧 ref → 以新 ref 上架\n"
          : "  → 续做：上一轮已迁好登记，只补以新 ref 上架\n"
      );
      continue;
    }

    const result = await migrateCharacterRef(p.characterId);
    console.log(`  ${result.ok ? "✓" : "✗"} ${result.message}\n`);
  }

  if (plans.length === 0) {
    console.log("没有待迁移的。");
  } else if (!APPLY) {
    console.log("Dry run. Re-run with --apply to move these.");
  }
}

main().finally(() => prisma.$disconnect());
