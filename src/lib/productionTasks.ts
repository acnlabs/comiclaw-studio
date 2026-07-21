import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createAcnProductionTask, type AcnProductionType } from "@/lib/acn";

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

  const task = await createAcnProductionTask(args);

  const ref = await prisma.acnTaskRef.create({
    data: {
      acnTaskId: task.task_id,
      projectId: args.projectId,
      type: args.type,
      input: args.input as Prisma.InputJsonValue,
    },
  });

  await prisma.project.update({
    where: { id: args.projectId },
    data: {
      statusNote:
        args.type === "WRITE_SCRIPT"
          ? "剧本任务已提交主工作室(ACN)…"
          : "出图任务已提交主工作室(ACN)…",
    },
  });

  return { ref, task };
}
