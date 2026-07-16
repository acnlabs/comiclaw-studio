import { prisma } from "@/lib/db";
import { withAgentAuth, parseBody } from "@/lib/api";
import { badRequest, notFoundJson } from "@/lib/auth";
import { updateCharacterSchema } from "@/lib/schemas";
import { syncCharacterListing } from "@/lib/characterListing";
import {
  unlistCharacterListing,
  revokeCharacterAsset,
  storeConfigured,
  verifyAgentExists,
} from "@/lib/agentplanet";

type Ctx = { params: Promise<{ characterId: string }> };

export const PATCH = withAgentAuth(async (req, ctx: Ctx) => {
  const { characterId } = await ctx.params;
  const body = await parseBody(req, updateCharacterSchema);
  const existing = await prisma.agentCharacter.findUnique({
    where: { id: characterId },
    select: { id: true, storeProductId: true, acnAgentId: true, licensePoints: true },
  });
  if (!existing) return notFoundJson();

  // 付费角色的收款方校验(与创建时一致):按「本次更新后的生效值」判断。
  // 只在收款相关字段被本次请求触碰时才发起远端校验,避免无关更新的额外延迟。
  const effectivePoints = body.licensePoints ?? existing.licensePoints;
  const effectiveAgentId =
    body.acnAgentId === undefined ? existing.acnAgentId : body.acnAgentId;
  if (effectivePoints > 0) {
    if (!effectiveAgentId) {
      return badRequest(
        "`acnAgentId` is required when `licensePoints` > 0 (it is the payee of licensing revenue)"
      );
    }
    const touched = body.acnAgentId !== undefined || body.licensePoints !== undefined;
    if (touched && (await verifyAgentExists(effectiveAgentId)) === false) {
      return badRequest(
        `acnAgentId "${effectiveAgentId}" does not exist on AgentPlanet — licensing revenue would be unrecoverable. Double-check the agent id.`
      );
    }
  }

  const character = await prisma.agentCharacter.update({
    where: { id: characterId },
    data: {
      name: body.name ?? undefined,
      tagline: body.tagline === undefined ? undefined : body.tagline,
      persona: body.persona === undefined ? undefined : body.persona,
      styleTags: body.styleTags === undefined ? undefined : body.styleTags,
      imageUrl: body.imageUrl ?? undefined,
      audioUrl: body.audioUrl === undefined ? undefined : body.audioUrl,
      gallery: body.gallery === undefined ? undefined : body.gallery,
      introVideoUrl: body.introVideoUrl === undefined ? undefined : body.introVideoUrl,
      acnAgentId: body.acnAgentId === undefined ? undefined : body.acnAgentId,
      agentName: body.agentName === undefined ? undefined : body.agentName,
      agentSummary: body.agentSummary === undefined ? undefined : body.agentSummary,
      agentUrl: body.agentUrl === undefined ? undefined : body.agentUrl,
      isPublic: body.isPublic ?? undefined,
      openForCasting: body.openForCasting ?? undefined,
      licensePoints: body.licensePoints ?? undefined,
    },
  });
  // 付费状态/价格/收款方变更时同步 Store 商品(上架/改价/下架/改绑重上,best effort)
  const synced = await syncCharacterListing(character, {
    storeProductId: existing.storeProductId,
    acnAgentId: existing.acnAgentId,
  });
  return Response.json({ character: synced ?? character });
});

export const DELETE = withAgentAuth(async (_req, ctx: Ctx) => {
  const { characterId } = await ctx.params;
  const exists = await prisma.agentCharacter.findUnique({
    where: { id: characterId },
    select: { id: true, storeProductId: true, acnAgentId: true },
  });
  if (!exists) return notFoundJson();
  // 先下架 Store 商品 + 注销产权登记(均 best effort),再删角色
  if (storeConfigured()) {
    if (exists.storeProductId && exists.acnAgentId) {
      await unlistCharacterListing(exists.storeProductId, exists.acnAgentId);
    }
    await revokeCharacterAsset(characterId);
  }
  await prisma.agentCharacter.delete({ where: { id: characterId } });
  return Response.json({ deleted: true });
});
