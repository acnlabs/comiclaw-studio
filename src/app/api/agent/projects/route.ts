import { prisma } from "@/lib/db";
import { withAgentAuth, parseBody } from "@/lib/api";
import { createProjectSchema } from "@/lib/schemas";

// 创建项目
export const POST = withAgentAuth(async (req) => {
  const body = await parseBody(req, createProjectSchema);
  const project = await prisma.project.create({
    data: {
      name: body.name,
      clientName: body.clientName ?? null,
      agentName: body.agentName ?? null,
      description: body.description ?? null,
      coverUrl: body.coverUrl ?? null,
      ownerUserId: body.ownerUserId ?? null,
    },
  });
  return Response.json(
    {
      id: project.id,
      shareToken: project.shareToken,
      sharePath: `/p/${project.shareToken}`,
    },
    { status: 201 }
  );
});

// 项目列表
export const GET = withAgentAuth(async () => {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      clientName: true,
      agentName: true,
      currentStage: true,
      shareToken: true,
      updatedAt: true,
    },
  });
  return Response.json({ projects });
});
