import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { storeConfigured, getCharacterListing } from "@/lib/agentplanet";

type Ctx = { params: Promise<{ characterId: string }> };

// 查询角色在 AgentPlanet Store 的上架/审核状态。
// Store 内容审核是「先发后审」:上架即生效但 review_status=pending,被拒会自动下架。
// comiclaw 用此端点获取审核结论;被拒时读 reviewReason,修改角色文案后重新
// update-character 触发重新上架与重审。
export const GET = withAgentAuth(async (_req, ctx: Ctx) => {
  const { characterId } = await ctx.params;
  const character = await prisma.agentCharacter.findUnique({
    where: { id: characterId },
    select: { id: true, licensePoints: true, storeProductId: true },
  });
  if (!character) return notFoundJson();

  if (!character.storeProductId) {
    return Response.json({
      listed: false,
      licensePoints: character.licensePoints,
      reason: character.licensePoints > 0
        ? (storeConfigured() ? "NOT_SYNCED_YET" : "STORE_NOT_CONFIGURED")
        : "FREE_CHARACTER",
    });
  }

  const listing = await getCharacterListing(character.storeProductId);
  if (!listing) {
    return Response.json(
      { listed: true, storeProductId: character.storeProductId, error: "STORE_UNAVAILABLE" },
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
  });
});
