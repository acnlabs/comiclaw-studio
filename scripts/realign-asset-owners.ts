/**
 * One-off remediation for assets published under the old ownership rule.
 *
 * Publishing used to derive ownership from the column/project Org, so a scene
 * made by an agent or a human inside an Org-bound column was registered to that
 * Org. Ownership now follows the author, and these rows have to catch up — both
 * locally and in the AgentPlanet registry, or a later listing would be rejected
 * for a seller/owner mismatch.
 *
 * Dry run:  npx tsx scripts/realign-asset-owners.ts
 * Apply:    npx tsx scripts/realign-asset-owners.ts --apply
 */
import { prisma } from "../src/lib/db";
import { changeAssetOwner } from "../src/lib/agentplanet";
import { assetKindFor, resolvePublishOwner, PUBLISHED } from "../src/lib/assetPublish";
import type { AssetOwner } from "../src/lib/assetRegistry";

const APPLY = process.argv.includes("--apply");

async function main() {
  // Only settled rows: an in-flight publish is mid-handshake and owns itself.
  const assets = await prisma.asset.findMany({
    where: { publishState: PUBLISHED, ownerType: { not: null } },
    select: {
      id: true,
      name: true,
      type: true,
      ownerType: true,
      ownerId: true,
      authorUserId: true,
      authorAgentId: true,
      project: { select: { ownerUserId: true, visibility: true } },
    },
  });

  type Pending = { asset: (typeof assets)[number]; expected: AssetOwner | null };

  const mismatched = assets.flatMap<Pending>((a) => {
    const expected = resolvePublishOwner({
      authorUserId: a.authorUserId,
      authorAgentId: a.authorAgentId,
      // Pre-authorship rows: the project owner is the only claimant we have.
      publisherSub: a.project?.ownerUserId ?? null,
    });
    if (!expected.ok) return [{ asset: a, expected: null }];
    if (expected.owner.type === a.ownerType && expected.owner.id === a.ownerId) {
      return [];
    }
    return [{ asset: a, expected: expected.owner }];
  });

  console.log(`${assets.length} published asset(s), ${mismatched.length} to realign`);

  for (const { asset, expected } of mismatched) {
    const from = `${asset.ownerType}:${asset.ownerId}`;
    if (!expected) {
      console.log(`  ! ${asset.name} (${asset.id}) held by ${from} — no author to hand it to, skipping`);
      continue;
    }
    const to = `${expected.type}:${expected.id}`;
    if (!APPLY) {
      console.log(`  · ${asset.name} (${asset.id}): ${from} → ${to}`);
      continue;
    }

    const kind = assetKindFor(asset.type);
    if (!kind) {
      console.log(`  ! ${asset.name} (${asset.id}): type ${asset.type} is not registrable, skipping`);
      continue;
    }
    // Registry first: leaving the local row ahead of the registry would make a
    // later listing fail a seller/owner check with no sign of why.
    const moved = await changeAssetOwner(kind, asset.id, expected, "realign");
    if (!moved) {
      console.log(`  ✗ ${asset.name} (${asset.id}): registry refused ${from} → ${to}, left as is`);
      continue;
    }
    await prisma.asset.updateMany({
      where: { id: asset.id, publishState: PUBLISHED, ownerType: asset.ownerType },
      data: { ownerType: expected.type, ownerId: expected.id },
    });
    console.log(`  ✓ ${asset.name} (${asset.id}): ${from} → ${to}`);
  }

  if (!APPLY && mismatched.length > 0) {
    console.log("\nDry run. Re-run with --apply to move these.");
  }
}

main().finally(() => prisma.$disconnect());
