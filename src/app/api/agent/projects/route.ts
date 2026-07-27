import { prisma } from "@/lib/db";
import { withAgentAuth, parseBody, withRetry } from "@/lib/api";
import { badRequest, notFoundJson } from "@/lib/auth";
import { createProjectSchema } from "@/lib/schemas";

async function nextEntryOrder(columnId: string): Promise<number> {
  const latest = await prisma.project.findFirst({
    where: { columnId, entryOrder: { not: null } },
    orderBy: { entryOrder: "desc" },
    select: { entryOrder: true },
  });
  return (latest?.entryOrder ?? 0) + 1;
}

// 创建项目
export const POST = withAgentAuth(async (req) => {
  const body = await parseBody(req, createProjectSchema);
  const visibility = body.visibility ?? "PRIVATE";
  const columnId = body.columnId?.trim() || null;

  if (columnId) {
    const column = await prisma.column.findUnique({
      where: { id: columnId },
      select: { id: true },
    });
    if (!column) return notFoundJson("Column not found");
  } else if (body.entryOrder != null) {
    return badRequest("entryOrder requires columnId");
  }

  const project = await withRetry(async () => {
    const entryOrder =
      columnId == null
        ? null
        : body.entryOrder !== undefined && body.entryOrder !== null
          ? body.entryOrder
          : await nextEntryOrder(columnId);

    return prisma.project.create({
      data: {
        name: body.name,
        clientName: body.clientName ?? null,
        agentName: body.agentName ?? null,
        description: body.description ?? null,
        coverUrl: body.coverUrl ?? null,
        ownerUserId: body.ownerUserId ?? null,
        visibility,
        columnId,
        entryOrder,
        ...(visibility === "PUBLIC" ? { isPrivate: false } : {}),
      },
    });
  });

  return Response.json(
    {
      id: project.id,
      shareToken: project.shareToken,
      sharePath: `/p/${project.shareToken}`,
      visibility: project.visibility,
      columnId: project.columnId,
      entryOrder: project.entryOrder,
    },
    { status: 201 }
  );
});

// 项目列表
export const GET = withAgentAuth(async (req) => {
  const url = new URL(req.url);
  const visibility = url.searchParams.get("visibility");
  const columnId = url.searchParams.get("columnId");
  const projects = await prisma.project.findMany({
    where: {
      ...(visibility === "PUBLIC" || visibility === "PRIVATE"
        ? { visibility }
        : {}),
      ...(columnId ? { columnId } : {}),
    },
    orderBy: [{ entryOrder: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      clientName: true,
      agentName: true,
      currentStage: true,
      shareToken: true,
      visibility: true,
      columnId: true,
      entryOrder: true,
      updatedAt: true,
    },
  });
  return Response.json({ projects });
});
