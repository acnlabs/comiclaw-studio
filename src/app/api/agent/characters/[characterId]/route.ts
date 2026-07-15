import { prisma } from "@/lib/db";
import { withAgentAuth, parseBody } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { updateCharacterSchema } from "@/lib/schemas";
import { syncCharacterListing } from "@/lib/characterListing";
import { unlistCharacterListing, storeConfigured } from "@/lib/agentplanet";

type Ctx = { params: Promise<{ characterId: string }> };

export const PATCH = withAgentAuth(async (req, ctx: Ctx) => {
  const { characterId } = await ctx.params;
  const body = await parseBody(req, updateCharacterSchema);
  const exists = await prisma.agentCharacter.findUnique({
    where: { id: characterId },
    select: { id: true },
  });
  if (!exists) return notFoundJson();

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
  // 付费状态/价格变更时同步 Store 商品(上架/改价/下架,best effort)
  const synced = await syncCharacterListing(character);
  return Response.json({ character: synced ?? character });
});

export const DELETE = withAgentAuth(async (_req, ctx: Ctx) => {
  const { characterId } = await ctx.params;
  const exists = await prisma.agentCharacter.findUnique({
    where: { id: characterId },
    select: { id: true, storeProductId: true, acnAgentId: true },
  });
  if (!exists) return notFoundJson();
  // 先下架 Store 商品(best effort),再删角色
  if (storeConfigured() && exists.storeProductId && exists.acnAgentId) {
    await unlistCharacterListing(exists.storeProductId, exists.acnAgentId);
  }
  await prisma.agentCharacter.delete({ where: { id: characterId } });
  return Response.json({ deleted: true });
});
