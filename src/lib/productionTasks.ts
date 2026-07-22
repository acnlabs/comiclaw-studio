import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  createAcnProductionTaskOnly,
  inviteAcnAgent,
  type AcnProductionType,
} from "@/lib/acn";

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
  workerAgentIds?: string[] | null;
  includeDefaultWorker?: boolean;
}) {
  const recent = await countRecentAcnTasks(args.projectId);
  if (recent >= MAX_ACTIVE_REFS_PER_PROJECT) {
    throw new Error(
      `Too many recent production tasks for this project (max ${MAX_ACTIVE_REFS_PER_PROJECT} / 7d)`
    );
  }

  // 顺序刻意为:ACN 建单 → 立刻落本地映射 → invite / 状态条降级为尽力而为。
  const { task, inviteeIds } = await createAcnProductionTaskOnly(args);

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
    throw new Error(
      `ACN task ${task.task_id} was created but Studio failed to persist the mapping — do NOT retry blindly (would duplicate the task). Record acnTaskId manually. Cause: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  const inviteErrors: Array<{ agentId: string; error: string }> = [];
  for (const agentId of inviteeIds) {
    try {
      await inviteAcnAgent(task.task_id, agentId);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      inviteErrors.push({ agentId, error });
      console.error(
        `[productionTasks] invite ${agentId} failed for ${task.task_id} (subnet visibility still applies)`,
        err
      );
    }
  }
  // 兼容旧响应字段:全部失败时给字符串;部分失败时拼摘要
  const inviteError =
    inviteErrors.length === 0
      ? null
      : inviteErrors.length === inviteeIds.length
        ? inviteErrors.map((e) => `${e.agentId}: ${e.error}`).join("; ")
        : `partial: ${inviteErrors.map((e) => `${e.agentId}: ${e.error}`).join("; ")}`;

  try {
    const workerHint =
      inviteeIds.length === 1 ? "生产工人" : `候选工人×${inviteeIds.length}`;
    await prisma.project.update({
      where: { id: args.projectId },
      data: {
        statusNote:
          args.type === "WRITE_SCRIPT"
            ? `剧本任务已提交${workerHint}(ACN)…`
            : `出图任务已提交${workerHint}(ACN)…`,
      },
    });
  } catch (err) {
    console.error(`[productionTasks] statusNote update failed for ${args.projectId}`, err);
  }

  return { ref, task, inviteError, inviteErrors, inviteeIds };
}
