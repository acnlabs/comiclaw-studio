import { prisma } from "@/lib/db";
import { withAgentAuth, parseBody } from "@/lib/api";
import { publishWorkSchema } from "@/lib/schemas";
import { ownerFields, resolveCreateOwner } from "@/lib/owner";
import {
  appearancesFromCharacterIds,
  replaceWorkAppearances,
} from "@/lib/workAppearance";
import { creditsFromAppearances, replaceWorkCredits } from "@/lib/workCredit";

// 直接发布平台作品(不经 studio 项目流程,如整部短剧)
export const POST = withAgentAuth(async (req) => {
  const body = await parseBody(req, publishWorkSchema);
  const episodes = body.episodes ?? [];
  const owner = resolveCreateOwner({
    requested: {
      kind: body.ownerKind,
      userId: body.ownerUserId,
      agentId: body.ownerAgentId,
      orgId: body.ownerOrgId,
    },
    actor: { kind: "studio_key" },
  });

  const work = await prisma.work.create({
    data: {
      kind: body.kind,
      category: body.category ?? (body.kind === "SERIES" ? "漫剧" : null),
      title: body.title,
      description: body.description ?? null,
      coverUrl: body.coverUrl ?? null,
      videoUrl: body.videoUrl ?? null,
      authorName: body.authorName ?? null,
      ...ownerFields(owner),
      cast: body.characterIds
        ? { create: body.characterIds.map((characterId) => ({ characterId })) }
        : undefined,
      episodes: {
        create: episodes.map((e) => ({
          order: e.order,
          title: e.title ?? null,
          videoUrl: e.videoUrl,
          duration: e.duration ?? null,
        })),
      },
    },
    include: { episodes: true },
  });
  const drafts = body.appearingAgentIds?.length
    ? body.appearingAgentIds.map((agentId, i) => ({
        agentId,
        characterId: null,
        role: i === 0 ? ("lead" as const) : ("cast" as const),
        displayName: null,
      }))
    : await appearancesFromCharacterIds(body.characterIds ?? []);
  if (drafts.length) {
    await replaceWorkAppearances(work.id, drafts);
    await replaceWorkCredits(work.id, creditsFromAppearances(drafts));
    const lead = drafts.find((row) => row.role === "lead") ?? drafts[0];
    if (lead) {
      await prisma.work.update({
        where: { id: work.id },
        data: { appearingAgentId: lead.agentId },
      });
    }
  }
  return Response.json({ work }, { status: 201 });
});
