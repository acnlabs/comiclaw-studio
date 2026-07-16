import { prisma } from "@/lib/db";
import { withAgentAuth, parseBody } from "@/lib/api";
import { badRequest } from "@/lib/auth";
import { createCharacterSchema } from "@/lib/schemas";
import { syncCharacterListing } from "@/lib/characterListing";
import { verifyAgentExists } from "@/lib/agentplanet";

// 创建智能体角色(数字人):comiclaw 直接创建,或从项目资产发布
export const POST = withAgentAuth(async (req) => {
  const body = await parseBody(req, createCharacterSchema);
  // 付费角色的收款方校验:授权收益会进 acnAgentId 的钱包,填错就是打钱给别人。
  // 只在「确认不存在」时拒绝;AgentPlanet 暂不可达(null)时放行——此时 Store 同步
  // 同样不可达,不会产生可购商品,无资金风险。
  if ((body.licensePoints ?? 0) > 0) {
    if (!body.acnAgentId) {
      return badRequest(
        "`acnAgentId` is required when `licensePoints` > 0 (it is the payee of licensing revenue)"
      );
    }
    if ((await verifyAgentExists(body.acnAgentId)) === false) {
      return badRequest(
        `acnAgentId "${body.acnAgentId}" does not exist on AgentPlanet — licensing revenue would be unrecoverable. Double-check the agent id.`
      );
    }
  }
  const character = await prisma.agentCharacter.create({
    data: {
      name: body.name,
      tagline: body.tagline ?? null,
      persona: body.persona ?? null,
      styleTags: body.styleTags ?? null,
      imageUrl: body.imageUrl,
      audioUrl: body.audioUrl ?? null,
      gallery: body.gallery ?? null,
      introVideoUrl: body.introVideoUrl ?? null,
      acnAgentId: body.acnAgentId ?? null,
      agentName: body.agentName ?? null,
      agentSummary: body.agentSummary ?? null,
      agentUrl: body.agentUrl ?? null,
      ownerUserId: body.ownerUserId ?? null,
      sourceProjectId: body.sourceProjectId ?? null,
      isPublic: body.isPublic ?? true,
      openForCasting: body.openForCasting ?? false,
      licensePoints: body.licensePoints ?? 0,
    },
  });
  // 付费角色同步上架到 AgentPlanet Store(best effort;失败时授权前会兜底上架)
  const synced = await syncCharacterListing(character);
  return Response.json({ character: synced ?? character }, { status: 201 });
});

// 角色列表(agent 查询)
export const GET = withAgentAuth(async () => {
  const characters = await prisma.agentCharacter.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return Response.json({ characters });
});
