import { prisma } from "@/lib/db";
import { withAgentAuth, parseBody } from "@/lib/api";
import { notFoundJson, badRequest } from "@/lib/auth";
import { chargeCreditsSchema } from "@/lib/schemas";
import { chargeWalletUsage } from "@/lib/agentplanet";

type Ctx = { params: Promise<{ id: string }> };

// 生产用量按次扣款:主 comiclaw 在调用即梦/Seedance 等上游生成前,先调这个
// 端点向项目所有者扣款,成功才继续生成、失败(通常是余额不足)就停下。
//
// 钱的权威账本在 AgentPlanet(/api/internal/wallet/charge 自己写 Transaction、
// 自己按 idempotency_key 去重)——这里落的 GenerationChargeRef 只是本地排障
// 用的"生成任务 ↔ 交易"关联指针,不是第二本账,不重复记"扣了多少钱"这份真相。
//
// 归属人(userSub)由服务端从项目记录读取,不接受调用方传入——跟 createProject
// 一样的强制原则:模型/skill 脚本没有任何参数能指定"替谁付钱",只能替它
// 认领到的这个项目的真实所有者扣款。
export const POST = withAgentAuth(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, chargeCreditsSchema);

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, ownerUserId: true },
  });
  if (!project) return notFoundJson();
  if (!project.ownerUserId) {
    return badRequest("Project has no owner; cannot charge for production usage");
  }

  const existing = await prisma.generationChargeRef.findUnique({
    where: { jobId: body.idempotencyKey },
  });
  if (existing && existing.projectId !== id) {
    return badRequest("idempotencyKey already used by a different project");
  }
  // 只有已成功扣过款才短路——AgentPlanet 侧的幂等键是权威的第一道防线,
  // 这里只是避免明知会成功却又发一次网络请求。失败的历史记录(余额不足/
  // 上游报错)允许重试覆盖:例如客户充值后重试,不能被"同一个 jobId 曾经
  // 失败过"卡死——AgentPlanet 那边本来就没真正扣过款。
  if (existing?.status === "SUCCESS") {
    return Response.json({ ref: existing, idempotent: true });
  }

  const result = await chargeWalletUsage({
    userSub: project.ownerUserId,
    amount: body.amount,
    reason: body.reason,
    idempotencyKey: body.idempotencyKey,
    projectId: id,
    metadata: body.metadata,
  });

  const baseData = {
    projectId: id,
    userSub: project.ownerUserId,
    amount: body.amount,
    action: body.action,
    provider: body.provider ?? null,
  };

  if (!result.ok) {
    if (result.code === "INSUFFICIENT_BALANCE") {
      const ref = await prisma.generationChargeRef.upsert({
        where: { jobId: body.idempotencyKey },
        create: { ...baseData, jobId: body.idempotencyKey, status: "INSUFFICIENT_BALANCE" },
        update: { status: "INSUFFICIENT_BALANCE", transactionId: null },
      });
      return Response.json(
        {
          error: "Insufficient balance",
          code: "INSUFFICIENT_BALANCE",
          balance: result.balance,
          required: result.required ?? body.amount,
          ref,
        },
        { status: 402 }
      );
    }
    await prisma.generationChargeRef.upsert({
      where: { jobId: body.idempotencyKey },
      create: { ...baseData, jobId: body.idempotencyKey, status: "ERROR" },
      update: { status: "ERROR", transactionId: null },
    });
    return Response.json(
      { error: result.message ?? "Charge failed", code: result.code },
      { status: 502 }
    );
  }

  const ref = await prisma.generationChargeRef.upsert({
    where: { jobId: body.idempotencyKey },
    create: {
      ...baseData,
      jobId: body.idempotencyKey,
      status: "SUCCESS",
      transactionId: result.transactionId,
    },
    update: { status: "SUCCESS", transactionId: result.transactionId },
  });

  return Response.json(
    { ref, balance: result.balance, idempotent: result.idempotent },
    { status: 201 }
  );
});

// 查询这个项目已经发起过的生成任务扣款(排障用的本地关联记录);
// 权威金额/余额以 AgentPlanet 的 Transaction 为准,这里不做汇总统计。
export const GET = withAgentAuth(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return notFoundJson();

  const refs = await prisma.generationChargeRef.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ refs });
});
