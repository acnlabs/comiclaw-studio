/**
 * Give every existing marketplace character a backing Asset.
 *
 * Creates draft assets only: nothing is registered, priced or listed, so this
 * changes no external state and no money moves. The cutover that repoints
 * `comiclaw:character:*` at the new ids is a separate, explicit step.
 *
 * Dry run:  npx tsx scripts/backfill-character-assets.ts
 * Apply:    npx tsx scripts/backfill-character-assets.ts --apply
 */
import { prisma } from "../src/lib/db";
import { backingAssetInput } from "../src/lib/characterAsset";

const APPLY = process.argv.includes("--apply");

async function main() {
  const characters = await prisma.agentCharacter.findMany({
    where: { assetId: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      tagline: true,
      imageUrl: true,
      audioUrl: true,
      ownerUserId: true,
      acnAgentId: true,
      licensePoints: true,
      storeProductId: true,
    },
  });

  const total = await prisma.agentCharacter.count();
  console.log(`${total} character(s), ${characters.length} without a backing asset`);

  for (const c of characters) {
    const input = backingAssetInput(c);
    const held =
      input.authorUserId ?? input.authorAgentId ?? "nobody (legacy)";
    // Registered characters are the ones the cutover has to touch, so call
    // them out here rather than leaving them to be discovered later.
    const registered =
      c.licensePoints > 0 || c.storeProductId
        ? ` — REGISTERED (${c.licensePoints} credits${c.storeProductId ? `, product ${c.storeProductId}` : ""})`
        : "";

    if (!APPLY) {
      console.log(`  · ${c.name} (${c.id}) → author ${held}${registered}`);
      continue;
    }

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
      where: { id: c.id },
      data: { assetId: asset.id },
    });
    console.log(`  ✓ ${c.name} (${c.id}) → asset ${asset.id}${registered}`);
  }

  if (!APPLY && characters.length > 0) {
    console.log("\nDry run. Re-run with --apply to create these.");
  }
}

main().finally(() => prisma.$disconnect());
