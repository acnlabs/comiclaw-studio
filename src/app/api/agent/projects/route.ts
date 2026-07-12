import { prisma } from "@/lib/db";
import { checkApiKey, unauthorized, badRequest } from "@/lib/auth";

// 创建项目
export async function POST(req: Request) {
  if (!checkApiKey(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  if (!body?.name) return badRequest("`name` is required");

  const project = await prisma.project.create({
    data: {
      name: body.name,
      clientName: body.clientName ?? null,
      agentName: body.agentName ?? null,
      description: body.description ?? null,
      coverUrl: body.coverUrl ?? null,
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
}

// 项目列表(供 agent 查询自己创建过的项目)
export async function GET(req: Request) {
  if (!checkApiKey(req)) return unauthorized();
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
}
