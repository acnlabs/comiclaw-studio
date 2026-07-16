import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { getCheckout, acceptCastingOrder } from "@/lib/agentplanet";
import type { AgentCharacter } from "@prisma/client";

// 授予选角授权 + 物化角色到项目资产库(免费授予与付费确认共用)
export async function grantLicense(args: {
  character: AgentCharacter;
  projectId: string;
  sub: string;
  points: number;
  orderId: string | null;
}) {
  const { character, projectId, sub, points, orderId } = args;
  const [license] = await prisma.$transaction([
    prisma.castingLicense.upsert({
      where: { characterId_projectId: { characterId: character.id, projectId } },
      create: {
        characterId: character.id,
        projectId,
        licenseeSub: sub,
        points,
        status: "GRANTED",
        storeOrderId: orderId,
      },
      update: { status: "GRANTED", points, storeOrderId: orderId },
    }),
    prisma.asset.create({
      data: {
        projectId,
        type: "CHARACTER",
        name: character.name,
        description:
          character.tagline ??
          (character.persona ? character.persona.slice(0, 200) : null),
        versions: {
          create: {
            version: 1,
            imageUrl: character.imageUrl,
            audioUrl: character.audioUrl,
            notes: "来自角色市场授权 / Licensed from Cast",
          },
        },
      },
    }),
  ]);
  emitProjectUpdate(projectId, "asset.created");
  return license;
}

// 惰性兜底自愈:客户付款后可能没有回到 Studio 手动确认(关掉标签页/切走没回来)。
// 每次触碰到该客户账号相关的接口(如「我的项目」列表)时顺手检查一遍他名下卡在
// PENDING_PAYMENT 的授权 —— 只要客户还会用 Studio,授权就一定会被补上,不依赖
// 客户端轮询或定时任务。零命中时只有一次轻量 DB 查询,几乎无额外开销。
export async function reconcilePendingLicenses(sub: string): Promise<void> {
  const pending = await prisma.castingLicense.findMany({
    where: { licenseeSub: sub, status: "PENDING_PAYMENT", storeOrderId: { not: null } },
    include: { character: true },
  });
  if (pending.length === 0) return;

  for (const license of pending) {
    if (!license.storeOrderId) continue;
    try {
      const checkout = await getCheckout(license.storeOrderId);
      if (!checkout) continue; // Store 暂时不可达,下次再试

      if (checkout.state === "fulfilling" || checkout.state === "completed") {
        // 买家须与支付时一致,否则跳过(留给下次;不主动清理,避免误删他人凑巧同订单的记录)
        if (checkout.buyer_id && checkout.buyer_id !== sub) continue;
        await grantLicense({
          character: license.character,
          projectId: license.projectId,
          sub,
          points: checkout.amount_credits,
          orderId: license.storeOrderId,
        });
        await acceptCastingOrder(license.storeOrderId, sub);
      } else if (
        checkout.state === "cancelled" ||
        checkout.state === "expired" ||
        checkout.state === "refunded"
      ) {
        // 订单已死:清掉这条卡住的占位记录,客户下次可以重新发起
        await prisma.castingLicense.delete({ where: { id: license.id } }).catch(() => {});
      }
      // state === "pending":还没付款,什么都不做,下次再查
    } catch {
      // best effort:单条失败不影响其它记录,也不影响调用方主流程
    }
  }
}
