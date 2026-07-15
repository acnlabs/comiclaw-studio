import { prisma } from "@/lib/db";
import {
  storeConfigured,
  upsertCharacterListing,
  unlistCharacterListing,
} from "@/lib/agentplanet";
import type { AgentCharacter } from "@prisma/client";

// 把角色的付费授权状态同步到 AgentPlanet Store(agent_asset 商品)。
// - licensePoints > 0 且有收款方(acnAgentId):上架/更新商品,回填 storeProductId
// - licensePoints = 0 且此前有商品:下架
// best effort:Store 不可达时不阻塞角色本身的创建/更新,付费授权前会兜底上架。
export async function syncCharacterListing(
  character: AgentCharacter
): Promise<AgentCharacter | null> {
  if (!storeConfigured()) return null;

  if (character.licensePoints > 0 && character.acnAgentId) {
    const productId = await upsertCharacterListing({
      storeProductId: character.storeProductId,
      characterId: character.id,
      name: character.name,
      tagline: character.tagline,
      imageUrl: character.imageUrl,
      sellerAgentId: character.acnAgentId,
      credits: character.licensePoints,
    });
    if (productId && productId !== character.storeProductId) {
      return prisma.agentCharacter.update({
        where: { id: character.id },
        data: { storeProductId: productId },
      });
    }
    return null;
  }

  if (character.storeProductId && character.acnAgentId) {
    await unlistCharacterListing(character.storeProductId, character.acnAgentId);
  }
  return null;
}
