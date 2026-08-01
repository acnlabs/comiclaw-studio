import { prisma } from "@/lib/db";
import { withAgentAuth, parseBody } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { updateColumnSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAgentAuth(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const column = await prisma.column.findUnique({
    where: { id },
    include: {
      projects: {
        orderBy: [{ entryOrder: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          shareToken: true,
          visibility: true,
          entryOrder: true,
          coverUrl: true,
          currentStage: true,
          acnOrgId: true,
          contributePolicy: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!column) return notFoundJson();
  return Response.json({ column });
});

export const PATCH = withAgentAuth(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, updateColumnSchema);
  const exists = await prisma.column.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) return notFoundJson();

  const column = await prisma.column.update({
    where: { id },
    data: {
      slug: body.slug ?? undefined,
      name: body.name ?? undefined,
      description: body.description === undefined ? undefined : body.description,
      coverUrl: body.coverUrl === undefined ? undefined : body.coverUrl,
      acnOrgId:
        body.acnOrgId === undefined
          ? undefined
          : body.acnOrgId?.trim() || null,
      contributePolicy: body.contributePolicy ?? undefined,
      // 运维划归不走用户建栏目的配额:配额防的是一个人自己刷一堆栏目,
      // 而这是把一个已存在的官方栏目交给具体的人来治理。
      ownerUserId:
        body.ownerUserId === undefined
          ? undefined
          : body.ownerUserId?.trim() || null,
      editorAgentId:
        body.editorAgentId === undefined
          ? undefined
          : body.editorAgentId?.trim() || null,
    },
  });
  return Response.json({ column });
});

export const DELETE = withAgentAuth(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const exists = await prisma.column.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) return notFoundJson();
  // onDelete SetNull: projects stay, columnId cleared
  await prisma.column.delete({ where: { id } });
  return Response.json({ deleted: true });
});
