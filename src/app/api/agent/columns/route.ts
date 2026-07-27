import { prisma } from "@/lib/db";
import { withAgentAuth, parseBody } from "@/lib/api";
import { createColumnSchema } from "@/lib/schemas";

// 创建栏目(如《AI 漫记》)
export const POST = withAgentAuth(async (req) => {
  const body = await parseBody(req, createColumnSchema);
  const column = await prisma.column.create({
    data: {
      slug: body.slug,
      name: body.name,
      description: body.description ?? null,
      coverUrl: body.coverUrl ?? null,
    },
  });
  return Response.json({ column }, { status: 201 });
});

// 栏目列表
export const GET = withAgentAuth(async () => {
  const columns = await prisma.column.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { projects: true } },
    },
  });
  return Response.json({
    columns: columns.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      coverUrl: c.coverUrl,
      projectCount: c._count.projects,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  });
});
