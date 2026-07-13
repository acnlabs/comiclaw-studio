import { prisma } from "@/lib/db";

// 项目全量数据查询(工作台页面与私密项目 API 共用)
export function findFullProjectByToken(shareToken: string) {
  return prisma.project.findUnique({
    where: { shareToken },
    include: {
      scriptVersions: { orderBy: { version: "desc" } },
      assets: {
        orderBy: { createdAt: "asc" },
        include: { versions: { orderBy: { version: "desc" } } },
      },
      shots: {
        orderBy: { order: "asc" },
        include: {
          versions: { orderBy: { version: "desc" } },
          assetRefs: {
            include: { asset: { select: { id: true, name: true, type: true } } },
          },
        },
      },
      filmVersions: { orderBy: { version: "desc" } },
      releases: { orderBy: { createdAt: "asc" } },
    },
  });
}
