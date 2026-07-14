import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import CharacterDetailView from "@/components/CharacterDetailView";

export const dynamic = "force-dynamic";

export default async function CharacterDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const c = await prisma.agentCharacter.findUnique({ where: { id } });
  if (!c || !c.isPublic) notFound();

  // 参演作品 = 显式参演关系(WorkCast)∪ 来源项目发布的作品
  const [castWorks, sourceWorks] = await Promise.all([
    prisma.workCast.findMany({
      where: { characterId: id },
      include: {
        work: { select: { id: true, title: true, coverUrl: true, kind: true } },
      },
    }),
    c.sourceProjectId
      ? prisma.work.findMany({
          where: { projectId: c.sourceProjectId },
          select: { id: true, title: true, coverUrl: true, kind: true },
        })
      : Promise.resolve([]),
  ]);
  const workMap = new Map<string, { id: string; title: string; coverUrl: string | null; kind: string }>();
  for (const w of [...castWorks.map((cw) => cw.work), ...sourceWorks]) {
    workMap.set(w.id, w);
  }
  const works = Array.from(workMap.values());

  // 顶部上/下一个角色导航(按公开列表的排序)
  const siblings = await prisma.agentCharacter.findMany({
    where: { isPublic: true },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  const idx = siblings.findIndex((s) => s.id === id);
  const prevId = idx > 0 ? siblings[idx - 1].id : null;
  const nextId = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1].id : null;

  return (
    <CharacterDetailView
      character={{
        id: c.id,
        name: c.name,
        tagline: c.tagline,
        persona: c.persona,
        styleTags: c.styleTags,
        imageUrl: c.imageUrl,
        audioUrl: c.audioUrl,
        gallery: c.gallery,
        introVideoUrl: c.introVideoUrl,
        acnAgentId: c.acnAgentId,
        agentName: c.agentName,
        agentSummary: c.agentSummary,
        agentUrl: c.agentUrl,
        openForCasting: c.openForCasting,
        licensePoints: c.licensePoints,
        createdAt: c.createdAt.toISOString(),
      }}
      works={works}
      prevId={prevId}
      nextId={nextId}
    />
  );
}
