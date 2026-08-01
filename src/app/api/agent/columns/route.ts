import { prisma } from "@/lib/db";
import { withAgentAuth, parseBody } from "@/lib/api";
import { createColumnSchema } from "@/lib/schemas";
import { resolveOrgBindOnCreate } from "@/lib/orgBinding";

// 创建栏目(如《AI 漫记》);可选新建/挂载 ACN Org
export const POST = withAgentAuth(async (req) => {
  const body = await parseBody(req, createColumnSchema);

  const bind = await resolveOrgBindOnCreate({
    mode: body.orgMode,
    acnOrgId: body.acnOrgId,
    displayName: body.name,
    stewardAgentId: body.stewardAgentId,
    joinPolicy: body.orgJoinPolicy,
  });
  if (bind instanceof Response) return bind;

  const column = await prisma.column.create({
    data: {
      slug: body.slug,
      name: body.name,
      description: body.description ?? null,
      coverUrl: body.coverUrl ?? null,
      acnOrgId: bind.acnOrgId,
      acnSubnetId: bind.acnSubnetId,
      contributePolicy: body.contributePolicy ?? "org_members",
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
      acnOrgId: c.acnOrgId,
      acnSubnetId: c.acnSubnetId,
      contributePolicy: c.contributePolicy,
      // 认领之后要能确认认领生效了,否则运维只能盲改
      ownerUserId: c.ownerUserId,
      editorAgentId: c.editorAgentId,
      projectCount: c._count.projects,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  });
});
