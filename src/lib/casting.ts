import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { getCheckout, acceptCastingOrder } from "@/lib/agentplanet";
import { Prisma, type AgentCharacter } from "@prisma/client";

// 授予选角授权 + 物化角色到项目资产库(免费授予与付费确认共用)。
//
// 并发安全:确认授权的触发源有多个(客户端轮询/焦点检测/手动点击/服务端自愈),
// 完全可能同时到达。资产物化必须恰好一次,靠「原子抢占转移」保证:
// - 已有 PENDING 行 → updateMany 条件转移(行锁串行化),只有真正把状态翻到
//   GRANTED 的调用者才物化资产,输家看到 count=0 直接返回既有记录;
// - 无行(免费首次授予)→ create 靠 (characterId, projectId) 唯一约束兜底,
//   撞约束(P2002)说明另一并发调用已授予并物化,返回既有记录即可。
export async function grantLicense(args: {
  character: AgentCharacter;
  projectId: string;
  sub: string;
  points: number;
  orderId: string | null;
}) {
  const { character, projectId, sub, points, orderId } = args;
  const uniqueWhere = {
    characterId_projectId: { characterId: character.id, projectId },
  };

  const materializeAsset = (tx: Prisma.TransactionClient) =>
    tx.asset.create({
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
    });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const flipped = await tx.castingLicense.updateMany({
        where: {
          characterId: character.id,
          projectId,
          status: { not: "GRANTED" },
        },
        data: { status: "GRANTED", licenseeSub: sub, points, storeOrderId: orderId },
      });
      if (flipped.count > 0) {
        await materializeAsset(tx);
        return {
          license: await tx.castingLicense.findUniqueOrThrow({ where: uniqueWhere }),
          created: true,
        };
      }
      const existing = await tx.castingLicense.findUnique({ where: uniqueWhere });
      if (existing) {
        // 已是 GRANTED(本次或并发调用已授予),资产已物化,不重复创建
        return { license: existing, created: false };
      }
      const license = await tx.castingLicense.create({
        data: {
          characterId: character.id,
          projectId,
          licenseeSub: sub,
          points,
          status: "GRANTED",
          storeOrderId: orderId,
        },
      });
      await materializeAsset(tx);
      return { license, created: true };
    });
    if (result.created) emitProjectUpdate(projectId, "asset.created");
    return result.license;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.castingLicense.findUnique({ where: uniqueWhere });
      if (existing) return existing;
    }
    throw e;
  }
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
        // 买家须与支付时一致,否则跳过(留给下次;不主动清理,避免误删他人凑巧同订单的记录)。
        // 未回填 buyer_id 也不放行(纵深防御,不依赖对方内部实现细节)。
        if (!checkout.buyer_id || checkout.buyer_id !== sub) continue;
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
