import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { checkApiKey, unauthorized, badRequest, notFoundJson } from "@/lib/auth";

const VALID_STAGES = ["SCRIPT", "ASSETS", "STORYBOARD", "FILM", "RELEASE", "DONE"];

// 读取项目全量数据
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!checkApiKey(req)) return unauthorized();
  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      scriptVersions: { orderBy: { version: "desc" } },
      assets: { include: { versions: { orderBy: { version: "desc" } } } },
      shots: {
        orderBy: { order: "asc" },
        include: {
          versions: { orderBy: { version: "desc" } },
          assetRefs: { include: { asset: { select: { id: true, name: true, type: true } } } },
        },
      },
      filmVersions: { orderBy: { version: "desc" } },
      releases: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!project) return notFoundJson();
  return Response.json({ project });
}

// 删除项目(级联删除所有关联数据)
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!checkApiKey(req)) return unauthorized();
  const { id } = await ctx.params;
  const exists = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return notFoundJson();
  await prisma.project.delete({ where: { id } });
  return Response.json({ deleted: true });
}

// 更新项目信息 / 推进阶段
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!checkApiKey(req)) return unauthorized();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");
  if (body.currentStage && !VALID_STAGES.includes(body.currentStage)) {
    return badRequest(`currentStage must be one of ${VALID_STAGES.join(", ")}`);
  }

  const exists = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return notFoundJson();

  const project = await prisma.project.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      clientName: body.clientName ?? undefined,
      agentName: body.agentName ?? undefined,
      description: body.description ?? undefined,
      coverUrl: body.coverUrl ?? undefined,
      currentStage: body.currentStage ?? undefined,
    },
  });
  emitProjectUpdate(id, "project.updated");
  return Response.json({ project });
}
