/**
 * Retire the registrations that still point at a character's own id.
 *
 * The registry subject is now the character's backing asset
 * (`comiclaw:character:{Asset.id}`), so the old entries
 * (`comiclaw:character:{AgentCharacter.id}`) are leftovers.
 *
 * Same logic as `GET/POST /api/admin/character-refs`; use that against
 * production so the credentials stay on the server. This script is for running
 * it against a database you already have in hand.
 *
 * Dry run:  npx tsx scripts/retire-legacy-character-refs.ts
 * Apply:    npx tsx scripts/retire-legacy-character-refs.ts --apply
 */
import { prisma } from "../src/lib/db";
import {
  planRetirement,
  retireConfigured,
  runRetirement,
} from "../src/lib/characterRefRetire";

const APPLY = process.argv.includes("--apply");

async function main() {
  if (!retireConfigured()) {
    console.error("AGENTPLANET_API_URL / AGENTPLANET_INTERNAL_TOKEN are not set");
    process.exit(1);
  }

  if (!APPLY) {
    const stale = await planRetirement();
    for (const s of stale) {
      console.log(
        `· ${s.name} (${s.characterId}) — 旧 ref 仍在登记，产权 ${s.owner}` +
          (s.storeProductId ? `，旧商品 ${s.storeProductId}` : "") +
          (s.licensePoints > 0 ? `，价 ${s.licensePoints}` : "")
      );
    }
    console.log(
      stale.length === 0
        ? "没有指向角色 id 的旧登记。"
        : `\n${stale.length} 条旧登记。加 --apply 注销。`
    );
    return;
  }

  const results = await runRetirement();
  for (const r of results) {
    const note = r.unlisted === false ? "（下架失败，未注销）" : "";
    console.log(`${r.revoked ? "✓" : "✗"} ${r.name} (${r.characterId})${note}`);
  }
  if (results.length === 0) console.log("没有指向角色 id 的旧登记。");
}

main().finally(() => prisma.$disconnect());
