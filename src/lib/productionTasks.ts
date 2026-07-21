import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createAcnProductionTaskOnly, inviteAcnProductionAgent, type AcnProductionType } from "@/lib/acn";

const MAX_ACTIVE_REFS_PER_PROJECT = 8;

// 同一项目未完成交付的 ACN 任务映射上限(防刷)。状态以 ACN 为准,
// 这里用「最近建单且尚未在 Studio 侧标记过期」的粗计数——只数映射行数
// 近 7 天内的,避免永远涨。
export async function countRecentAcnTasks(projectId: string): Promise<number> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return prisma.acnTaskRef.count({
    where: { projectId, createdAt: { gte: since } },
  });
}

export async function enqueueAcnProductionTask(args: {
  projectId: string;
  projectName: string;
  ownerUserId: string;
  type: AcnProductionType;
  input: Record<string, unknown>;
}) {
  const recent = await countRecentAcnTasks(args.projectId);
  if (recent >= MAX_ACTIVE_REFS_PER_PROJECT) {
    throw new Error(
      `Too many recent production tasks for this project (max ${MAX_ACTIVE_REFS_PER_PROJECT} / 7d)`
    );
  }

  // 顺序刻意为:ACN 建单 → 立刻落本地映射 → invite / 状态条降级为尽力而为。
  // ACN 任务一旦建成,后续任何本地失败都不能让调用方误以为"没建成"而重试
  // 再建一单(重复生产 + 重复扣款)。invite 失败不算失败:任务挂在 private
  // subnet 上,生产 Agent 是成员,轮询任务列表也能看到并 accept。
  const task = await createAcnProductionTaskOnly(args);

  let ref;
  try {
    ref = await prisma.acnTaskRef.create({
      data: {
        acnTaskId: task.task_id,
        projectId: args.projectId,
        type: args.type,
        input: args.input as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // 映射没落库但 ACN 任务已存在:把 task_id 抛给调用方,禁止盲目重试建新单
    throw new Error(
      `ACN task ${task.task_id} was created but Studio failed to persist the mapping — do NOT retry blindly (would duplicate the task). Record acnTaskId manually. Cause: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  let inviteError: string | null = null;
  try {
    await inviteAcnProductionAgent(task.task_id);
  } catch (err) {
    inviteError = err instanceof Error ? err.message : String(err);
    console.error(`[productionTasks] invite failed for ${task.task_id} (subnet visibility still applies)`, err);
  }

  try {
    await prisma.project.update({
      where: { id: args.projectId },
      data: {
        statusNote:
          args.type === "WRITE_SCRIPT"
            ? "剧本任务已提交主工作室(ACN)…"
            : "出图任务已提交主工作室(ACN)…",
      },
    });
  } catch (err) {
    console.error(`[productionTasks] statusNote update failed for ${args.projectId}`, err);
  }

  return { ref, task, inviteError };
}
