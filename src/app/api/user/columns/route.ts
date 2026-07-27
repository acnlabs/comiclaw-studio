import { prisma } from "@/lib/db";

// 公开栏目列表(匿名可读);只展示至少有一记 PUBLIC 项目的栏目
export async function GET() {
  const columns = await prisma.column.findMany({
    where: {
      projects: { some: { visibility: "PUBLIC" } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      coverUrl: true,
      updatedAt: true,
      _count: {
        select: { projects: { where: { visibility: "PUBLIC" } } },
      },
    },
  });

  return Response.json({
    columns: columns.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      coverUrl: c.coverUrl,
      entryCount: c._count.projects,
      updatedAt: c.updatedAt,
    })),
  });
}
