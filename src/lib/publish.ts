import { prisma } from "@/lib/db";

// 项目发行上架后,把最新成片同步发布为平台作品(出现在「推荐」流)。
// 幂等:同一项目只对应一个作品,重复调用时更新。
export async function syncProjectToWork(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { filmVersions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!project) return null;

  const film = project.filmVersions[0];
  if (!film) return null; // 没有成片,无内容可发布

  const data = {
    kind: "VIDEO",
    title: project.name,
    description: project.description,
    coverUrl: project.coverUrl,
    videoUrl: film.videoUrl,
    authorName: project.clientName ?? project.agentName,
  };

  return prisma.work.upsert({
    where: { projectId },
    update: data,
    create: { ...data, projectId },
  });
}
