import { prisma } from "@/lib/db";
import { notFoundJson } from "@/lib/auth";

type Ctx = { params: Promise<{ slug: string }> };

// 栏目详情 + 其下 PUBLIC 记列表(匿名可读)
export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const column = await prisma.column.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      coverUrl: true,
      acnOrgId: true,
      acnSubnetId: true,
      contributePolicy: true,
      createdAt: true,
      updatedAt: true,
      projects: {
        // 纵向的记;一记下的共创不进时间线
        where: { visibility: "PUBLIC", parentProjectId: null },
        // 时间线最新在上; entryOrder 空值沉底,与栏目页一致
        orderBy: [
          { entryOrder: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
        ],
        select: {
          id: true,
          name: true,
          description: true,
          coverUrl: true,
          shareToken: true,
          entryOrder: true,
          acnOrgId: true,
          contributePolicy: true,
          updatedAt: true,
          createdAt: true,
        },
      },
    },
  });
  if (!column) return notFoundJson();
  return Response.json({ column });
}
