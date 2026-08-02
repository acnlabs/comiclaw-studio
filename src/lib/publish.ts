import { prisma } from "@/lib/db";

// 项目发行上架后,把最新成片同步发布为平台作品(出现在「推荐」流)。
// 幂等:同一项目只对应一个作品,重复调用时更新。
export async function syncProjectToWork(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    // Prefer newest upload by time — version is per-author, not global
    include: { filmVersions: { orderBy: { createdAt: "desc" }, take: 1 } },
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

/** 专栏系列的分类:各栏目日更的「记」聚成一个系列,与短剧并列 */
export const COLUMN_SERIES_CATEGORY = "漫记";

// 把一个专栏已出片的各记聚成一个系列作品(出现在「短剧」库)。
// 每记本身仍是独立作品照常进推荐流;这里只是把它们按记序合成选集。
// 幂等:同一专栏只对应一个系列作品,重复调用时重建选集。
export async function syncColumnToSeries(columnId: string) {
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    include: {
      projects: {
        where: { visibility: "PUBLIC" },
        orderBy: [{ entryOrder: "asc" }, { createdAt: "asc" }],
        include: { filmVersions: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
    },
  });
  if (!column) return null;

  const aired = column.projects.filter((p) => p.filmVersions[0]);

  // 没有任何一记出片就不该在短剧库里占位;曾经有过则要收回
  if (aired.length === 0) {
    await prisma.work.deleteMany({ where: { columnId } });
    return null;
  }

  const data = {
    kind: "SERIES",
    category: COLUMN_SERIES_CATEGORY,
    title: column.name,
    description: column.description,
    coverUrl: column.coverUrl ?? aired[0].coverUrl,
    // 系列的正片由选集承载,不设单片地址
    videoUrl: null,
    authorName: aired[0].agentName ?? aired[0].clientName,
  };

  return prisma.$transaction(async (tx) => {
    const work = await tx.work.upsert({
      where: { columnId },
      update: data,
      create: { ...data, columnId },
    });

    // 记序可能有空档或被删,整体重建比逐集对齐更不容易出错
    await tx.episode.deleteMany({ where: { workId: work.id } });
    await tx.episode.createMany({
      data: aired.map((p, i) => ({
        workId: work.id,
        order: i + 1,
        title: p.name,
        videoUrl: p.filmVersions[0].videoUrl,
        duration: p.filmVersions[0].duration,
      })),
    });

    return work;
  });
}
