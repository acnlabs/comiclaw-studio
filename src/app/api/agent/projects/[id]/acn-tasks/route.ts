import { prisma } from "@/lib/db";
import { withAgentAuth, withProjectWorkerAuth, parseBody } from "@/lib/api";
import { notFoundJson, badRequest } from "@/lib/auth";
import { createAcnProductionTaskSchema } from "@/lib/schemas";
import { acnProductionConfigured } from "@/lib/acn";
import { enqueueAcnProductionTask } from "@/lib/productionTasks";

type Ctx = { params: Promise<{ id: string }> };

// 为项目创建 ACN 生产任务(对话 Agent 身份建单 + invite 生产 Agent)。
// 本地只落 AcnTaskRef 映射;状态以 ACN 为准。
export const POST = withAgentAuth(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, createAcnProductionTaskSchema);

  if (!acnProductionConfigured()) {
    return Response.json(
      { error: "ACN production is not configured", code: "ACN_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, ownerUserId: true },
  });
  if (!project) return notFoundJson();
  if (!project.ownerUserId) {
    return badRequest("Project has no owner; cannot enqueue production tasks");
  }

  try {
    const { ref, task, inviteError } = await enqueueAcnProductionTask({
      projectId: project.id,
      projectName: project.name,
      ownerUserId: project.ownerUserId,
      type: body.type,
      input: body.input,
    });
    return Response.json({ ref, task, inviteError }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("Too many recent")) return badRequest(msg);
    console.error("[acn-tasks] create failed", err);
    return Response.json({ error: msg, code: "ACN_CREATE_FAILED" }, { status: 502 });
  }
});

export const GET = withProjectWorkerAuth(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return notFoundJson();

  const take = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 20) || 20, 50);
  const refs = await prisma.acnTaskRef.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take,
  });
  return Response.json({ refs });
});
