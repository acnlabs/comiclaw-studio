import { prisma } from "@/lib/db";
import {
  storeConfigured,
  upsertAssetListing,
  unlistAssetListing,
  registerAsset,
  changeAssetOwner,
} from "@/lib/agentplanet";
import { mayListAfterRegistration, type AssetOwner } from "@/lib/assetRegistry";
import { ensureBackingAsset } from "@/lib/characterAssetSync";
import type { AgentCharacter } from "@prisma/client";

// 角色今天只支持 agent 产权(收款方 = 角色所属智能体)。org / user 产权由
// 上层显式传入后再放开,避免把 org id 写进 agent 字段。
const agentOwner = (agentId: string): AssetOwner => ({
  type: "agent",
  id: agentId,
});

export type ListingSyncResult = {
  /** 有变更时返回新行,否则 null(调用方沿用原对象) */
  character: AgentCharacter | null;
  /**
   * 产权登记没成功,因此没有尝试上架。
   * AgentPlanet 全球与 CN 都开着 store_asset_registry_enforce,未登记资产不可
   * 上架/不可下单,所以登记失败必须让调用方知道——否则客户设了价、以为在售,
   * 实际买不了。
   */
  registryBlocked: boolean;
};

const unchanged = (): ListingSyncResult => ({
  character: null,
  registryBlocked: false,
});

// 把角色的付费授权状态同步到 AgentPlanet Store(agent_asset 商品)。
// - licensePoints > 0 且有收款方(acnAgentId):登记产权 → 上架/更新商品,回填 storeProductId
// - licensePoints = 0 且此前有商品:下架
// - 改绑收款方(acnAgentId 变化):Store 侧商品的 seller 不可变更,必须先以旧
//   seller 下架旧商品,再以新 seller 重新上架(否则改价等同步会被 403 静默拒绝,
//   收益持续流向旧智能体)
//
// 登记是 fail-closed:登记失败就不上架,并把 registryBlocked 报给调用方。
// Store 不可达仍不阻塞角色本身的创建/更新。
export async function syncCharacterListing(
  character: AgentCharacter,
  previous?: { storeProductId: string | null; acnAgentId: string | null }
): Promise<ListingSyncResult> {
  if (!storeConfigured()) return unchanged();

  // The registry subject is the backing asset, not the character row: one
  // `comiclaw:character:*` namespace can only mean one id space. A character
  // with no backing asset has nothing to register, and registering it under
  // its own id again would put the ambiguity straight back.
  const subjectId = character.assetId ?? (await ensureBackingAsset(character.id));
  if (!subjectId) {
    console.error("[characterListing] no backing asset to register", character.id);
    return { character: null, registryBlocked: true };
  }

  // A Store product carries the asset_ref it was created with, so the legacy
  // product (created under the character's own id) can never be reused for the
  // new subject — PATCHing it would just reactivate a listing that points at
  // the old ref. The product that belongs to the subject lives on the asset.
  const subject = await prisma.asset.findUnique({
    where: { id: subjectId },
    select: { storeProductId: true },
  });
  const subjectProductId = subject?.storeProductId ?? null;

  let current = character;
  let changed = false;

  // 收款方变了:旧商品必须用旧 seller 才能下架;登记表的产权同步变更
  // (change-owner 在 Store 侧还会自动下架旧 owner 的商品,双保险)
  if (
    previous?.storeProductId &&
    previous.acnAgentId &&
    current.acnAgentId !== previous.acnAgentId
  ) {
    await unlistAssetListing(previous.storeProductId, previous.acnAgentId);
    if (current.acnAgentId) {
      await changeAssetOwner(
        "character",
        subjectId,
        agentOwner(current.acnAgentId)
      );
    }
    current = await prisma.agentCharacter.update({
      where: { id: current.id },
      data: { storeProductId: null },
    });
    changed = true;
  }

  if (current.licensePoints > 0 && current.acnAgentId) {
    // 上架前先登记产权(登记表由此校验 seller == 产权人)。
    // 已存在(exists)说明此前登记过,产权人可能是旧收款方 → change-owner 对齐。
    const owner = agentOwner(current.acnAgentId);
    const reg = await registerAsset({
      kind: "character",
      localId: subjectId,
      owner,
      displayName: current.name,
      // 出镜 Agent 与产权分开:角色由该智能体出镜,同时也是当前收款方
      boundAgentId: current.acnAgentId,
    });
    const ownerRealigned =
      reg === "exists"
        ? await changeAssetOwner("character", subjectId, owner)
        : false;
    if (!mayListAfterRegistration({ registration: reg, ownerRealigned })) {
      console.error("[characterListing] registry blocked listing", current.id, reg);
      return { character: changed ? current : null, registryBlocked: true };
    }

    const productId = await upsertAssetListing({
      storeProductId: subjectProductId,
      kind: "character",
      localId: subjectId,
      name: current.name,
      tagline: current.tagline,
      imageUrl: current.imageUrl,
      owner,
      credits: current.licensePoints,
    });
    if (!productId) {
      return { character: changed ? current : null, registryBlocked: true };
    }
    if (productId !== subjectProductId) {
      await prisma.asset.update({
        where: { id: subjectId },
        data: { storeProductId: productId },
      });
    }
    // The character's own product predates the cutover and points at the old
    // ref. Now that the subject has its own listing, take the old one down so
    // the same character is not on sale twice.
    if (current.storeProductId && current.storeProductId !== productId) {
      await unlistAssetListing(current.storeProductId, owner.id);
    }
    if (productId !== current.storeProductId) {
      return {
        character: await prisma.agentCharacter.update({
          where: { id: current.id },
          data: { storeProductId: productId },
        }),
        registryBlocked: false,
      };
    }
    return { character: changed ? current : null, registryBlocked: false };
  }

  if (current.storeProductId) {
    if (current.acnAgentId) {
      await unlistAssetListing(current.storeProductId, current.acnAgentId);
    } else {
      // 商品是当初以某个收款 Agent 建的,而那个 id 已经不在本地了,所以没法
      // 匹配卖家去下架。留个响亮的日志:这条商品需要人工处理。
      console.error(
        "[characterListing] cannot unlist, payee unknown",
        current.id,
        current.storeProductId
      );
    }
  }
  return { character: changed ? current : null, registryBlocked: false };
}
