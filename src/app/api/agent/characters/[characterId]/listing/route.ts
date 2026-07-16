import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { storeConfigured, getCharacterListing } from "@/lib/agentplanet";

type Ctx = { params: Promise<{ characterId: string }> };

// 查询角色在 AgentPlanet Store 的上架/审核状态 + 授权收益统计。
// Store 内容审核是「先发后审」:上架即生效但 review_status=pending,被拒会自动下架。
// comiclaw 用此端点获取审核结论(被拒时读 reviewReason,修改角色文案后重新
// update-character 触发重新上架与重审),也可用统计数据向客户汇报角色的变现情况。
export const GET = withAgentAuth(async (_req, ctx: Ctx) => {
  const { characterId } = await ctx.params;
  const character = await prisma.agentCharacter.findUnique({
    where: { id: characterId },
    select: { id: true, licensePoints: true, storeProductId: true, ownerUserId: true },
  });
  if (!character) return notFoundJson();

  // 收益统计:GRANTED 授权按次计费(同客户加两个项目算两次),points 是成交时的
  // 快照单价——累计值是毛收入(平台抽佣前);实际到账智能体钱包的金额会更低。
  // 排除角色主人自用自己角色的记录(points 恒为 0,不是第三方需求信号,混进来会
  // 出现「授权了 5 个项目却只赚 2 个 Credits」这种自相矛盾的数字)。
  const externalLicenseFilter = {
    characterId,
    status: "GRANTED",
    ...(character.ownerUserId ? { licenseeSub: { not: character.ownerUserId } } : {}),
  } as const;
  const [licensedProjectCount, revenueAgg] = await Promise.all([
    prisma.castingLicense.count({ where: externalLicenseFilter }),
    prisma.castingLicense.aggregate({
      where: externalLicenseFilter,
      _sum: { points: true },
    }),
  ]);
  const stats = {
    licensedProjectCount,
    totalCreditsEarnedGross: revenueAgg._sum.points ?? 0,
  };

  if (!character.storeProductId) {
    return Response.json({
      listed: false,
      licensePoints: character.licensePoints,
      reason: character.licensePoints > 0
        ? (storeConfigured() ? "NOT_SYNCED_YET" : "STORE_NOT_CONFIGURED")
        : "FREE_CHARACTER",
      ...stats,
    });
  }

  const listing = await getCharacterListing(character.storeProductId);
  if (!listing) {
    return Response.json(
      { listed: true, storeProductId: character.storeProductId, error: "STORE_UNAVAILABLE", ...stats },
      { status: 502 }
    );
  }
  return Response.json({
    listed: true,
    storeProductId: listing.product_id,
    creditsPrice: listing.credits_price,
    isActive: listing.is_active,
    reviewStatus: listing.review_status,
    reviewReason: listing.review_reason,
    ...stats,
  });
});
