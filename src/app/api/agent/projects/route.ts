import { prisma } from "@/lib/db";
import { withAgentAuth, parseBody } from "@/lib/api";
import { createProjectSchema } from "@/lib/schemas";

// 创建项目
export const POST = withAgentAuth(async (req) => {
  const body = await parseBody(req, createProjectSchema);
  const visibility = body.visibility ?? "PRIVATE";
  const project = await prisma.project.create({
    data: {
      name: body.name,
      clientName: body.clientName ?? null,
      agentName: body.agentName ?? null,
      description: body.description ?? null,
      coverUrl: body.coverUrl ?? null,
      ownerUserId: body.ownerUserId ?? null,
      visibility,
      ...(visibility === "PUBLIC" ? { isPrivate: false } : {}),
    },
  });
  return Response.json(
    {
      id: project.id,
      shareToken: project.shareToken,
      sharePath: `/p/${project.shareToken}`,
      visibility: project.visibility,
    },
    { status: 201 }
  );
});

// 项目列表
export const GET = withAgentAuth(async (req) => {
  const url = new URL(req.url);
  const visibility = url.searchParams.get("visibility");
  const projects = await prisma.project.findMany({
    where:
      visibility === "PUBLIC" || visibility === "PRIVATE"
        ? { visibility }
        : undefined,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      clientName: true,
      agentName: true,
      currentStage: true,
      shareToken: true,
      visibility: true,
      updatedAt: true,
    },
  });
  return Response.json({ projects });
});
