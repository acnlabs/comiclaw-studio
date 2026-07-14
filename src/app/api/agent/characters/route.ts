import { prisma } from "@/lib/db";
import { withAgentAuth, parseBody } from "@/lib/api";
import { createCharacterSchema } from "@/lib/schemas";

// 创建智能体角色(数字人):comiclaw 直接创建,或从项目资产发布
export const POST = withAgentAuth(async (req) => {
  const body = await parseBody(req, createCharacterSchema);
  const character = await prisma.agentCharacter.create({
    data: {
      name: body.name,
      tagline: body.tagline ?? null,
      persona: body.persona ?? null,
      styleTags: body.styleTags ?? null,
      imageUrl: body.imageUrl,
      audioUrl: body.audioUrl ?? null,
      gallery: body.gallery ?? null,
      acnAgentId: body.acnAgentId ?? null,
      agentName: body.agentName ?? null,
      agentSummary: body.agentSummary ?? null,
      agentUrl: body.agentUrl ?? null,
      ownerUserId: body.ownerUserId ?? null,
      sourceProjectId: body.sourceProjectId ?? null,
      isPublic: body.isPublic ?? true,
      openForCasting: body.openForCasting ?? false,
    },
  });
  return Response.json({ character }, { status: 201 });
});

// 角色列表(agent 查询)
export const GET = withAgentAuth(async () => {
  const characters = await prisma.agentCharacter.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return Response.json({ characters });
});
