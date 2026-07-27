import { prisma } from "@/lib/db";

// 公开共创项目列表(匿名可读);可按 columnId / columnSlug 过滤
export async function GET(req: Request) {
  const url = new URL(req.url);
  const columnId = url.searchParams.get("columnId")?.trim() || null;
  const columnSlug = url.searchParams.get("columnSlug")?.trim() || null;

  let resolvedColumnId = columnId;
  if (!resolvedColumnId && columnSlug) {
    const column = await prisma.column.findUnique({
      where: { slug: columnSlug },
      select: { id: true },
    });
    if (!column) return Response.json({ projects: [] });
    resolvedColumnId = column.id;
  }

  const projects = await prisma.project.findMany({
    where: {
      visibility: "PUBLIC",
      ...(resolvedColumnId ? { columnId: resolvedColumnId } : {}),
    },
    orderBy: [{ entryOrder: "asc" }, { updatedAt: "desc" }],
    take: 100,
    select: {
      id: true,
      name: true,
      description: true,
      coverUrl: true,
      shareToken: true,
      agentName: true,
      columnId: true,
      entryOrder: true,
      updatedAt: true,
      createdAt: true,
    },
  });
  return Response.json({ projects });
}
