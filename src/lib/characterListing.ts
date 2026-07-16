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
// - 改绑收款方(acnAgentId 变化):Store 侧商品的 seller 不可变更,必须先以旧
//   seller 下架旧商品,再以新 seller 重新上架(否则改价等同步会被 403 静默拒绝,
//   收益持续流向旧智能体)
// best effort:Store 不可达时不阻塞角色本身的创建/更新,付费授权前会兜底上架。
export async function syncCharacterListing(
  character: AgentCharacter,
  previous?: { storeProductId: string | null; acnAgentId: string | null }
): Promise<AgentCharacter | null> {
  if (!storeConfigured()) return null;

  let current = character;
  let changed = false;

  // 收款方变了:旧商品必须用旧 seller 才能下架
  if (
    previous?.storeProductId &&
    previous.acnAgentId &&
    current.acnAgentId !== previous.acnAgentId
  ) {
    await unlistCharacterListing(previous.storeProductId, previous.acnAgentId);
    current = await prisma.agentCharacter.update({
      where: { id: current.id },
      data: { storeProductId: null },
    });
    changed = true;
  }

  if (current.licensePoints > 0 && current.acnAgentId) {
    const productId = await upsertCharacterListing({
      storeProductId: current.storeProductId,
      characterId: current.id,
      name: current.name,
      tagline: current.tagline,
      imageUrl: current.imageUrl,
      sellerAgentId: current.acnAgentId,
      credits: current.licensePoints,
    });
    if (productId && productId !== current.storeProductId) {
      return prisma.agentCharacter.update({
        where: { id: current.id },
        data: { storeProductId: productId },
      });
    }
    return changed ? current : null;
  }

  if (current.storeProductId && current.acnAgentId) {
    await unlistCharacterListing(current.storeProductId, current.acnAgentId);
  }
  return changed ? current : null;
}
