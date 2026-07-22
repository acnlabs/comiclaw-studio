import { prisma } from "@/lib/db";
import { withAgentAuth, parseBody } from "@/lib/api";
import { notFoundJson, badRequest } from "@/lib/auth";
import { chargeCreditsSchema } from "@/lib/schemas";
import { chargeWalletUsage } from "@/lib/agentplanet";
import { quoteCharge } from "@/lib/pricing";
import { emitProjectUpdate } from "@/lib/events";

type Ctx = { params: Promise<{ id: string }> };

function consumptionFromRef(
  ref: {
    jobId: string;
    amount: number | null;
    action: string | null;
    provider: string | null;
    status: string;
    transactionId: string | null;
  },
  extra?: {
    units?: number;
    unitPrice?: number;
    reason?: string;
    balance?: number | null;
    idempotent?: boolean;
  }
) {
  return {
    idempotencyKey: ref.jobId,
    action: ref.action,
    provider: ref.provider,
    amount: ref.amount ?? 0,
    units: extra?.units ?? null,
    unitPrice: extra?.unitPrice ?? null,
    reason: extra?.reason ?? null,
    status: ref.status,
    transactionId: ref.transactionId,
    balance: extra?.balance ?? null,
    idempotent: extra?.idempotent ?? false,
  };
}

// 生产用量按次扣款:工人上报 action+units,Studio 按价目表定价后向项目所有者扣款。
// 钱的权威账本在 AgentPlanet;本地 GenerationChargeRef 只是 jobId↔txn 映射。
// 归属人由服务端从项目读取,不接受调用方指定付款人。
export const POST = withAgentAuth(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, chargeCreditsSchema);

  let quote;
  try {
    quote = quoteCharge({
      action: body.action,
      units: body.units,
      provider: body.provider,
      reason: body.reason,
    });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : String(err));
  }

  if (body.amount !== undefined && body.amount !== quote.amount) {
    return badRequest(
      `amount ${body.amount} does not match Studio quote ${quote.amount} (unitPrice=${quote.unitPrice} × units=${quote.units}); omit amount and send action+units`
    );
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, ownerUserId: true, name: true },
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
  if (existing?.status === "SUCCESS") {
    // 与 AgentPlanet 409 同语义:同幂等键不得换套餐(action/金额)。
    // 本地短路前必须校验,否则会把新报价的 units 和旧 charged 拼进同一响应。
    const prevAmount = existing.amount ?? 0;
    if (existing.action !== quote.action || prevAmount !== quote.amount) {
      return Response.json(
        {
          error: "idempotencyKey already used with different charge parameters",
          code: "IDEMPOTENCY_CONFLICT",
          existing: {
            action: existing.action,
            amount: prevAmount,
            provider: existing.provider,
            transactionId: existing.transactionId,
          },
          requested: {
            action: quote.action,
            amount: quote.amount,
            units: quote.units,
            unitPrice: quote.unitPrice,
            provider: quote.provider,
          },
        },
        { status: 409 }
      );
    }
    return Response.json({
      ref: existing,
      idempotent: true,
      quote,
      consumption: consumptionFromRef(existing, {
        units: quote.units,
        unitPrice: quote.unitPrice,
        reason: quote.reason,
        idempotent: true,
      }),
      // 给工人写进 ACN submit / set-status 的短摘要
      submitHint: `charged=${prevAmount}; action=${existing.action}; txn=${existing.transactionId ?? "n/a"}; idempotent=true`,
    });
  }

  const meta = {
    ...(body.metadata ?? {}),
    action: quote.action,
    units: quote.units,
    unit_price: quote.unitPrice,
    provider: quote.provider,
  };

  // 免费动作:不打 AgentPlanet(接口要求 amount>0),仍落本地 SUCCESS 指针便于对账
  if (!quote.billable) {
    const ref = await prisma.generationChargeRef.upsert({
      where: { jobId: body.idempotencyKey },
      create: {
        projectId: id,
        userSub: project.ownerUserId,
        jobId: body.idempotencyKey,
        amount: 0,
        action: quote.action,
        provider: quote.provider,
        status: "SUCCESS",
        transactionId: null,
      },
      update: {
        status: "SUCCESS",
        amount: 0,
        action: quote.action,
        provider: quote.provider,
        transactionId: null,
      },
    });
    return Response.json(
      {
        ref,
        quote,
        consumption: consumptionFromRef(ref, {
          units: quote.units,
          unitPrice: quote.unitPrice,
          reason: quote.reason,
          balance: null,
          idempotent: false,
        }),
        submitHint: `charged=0; action=${quote.action}; units=${quote.units}; free=true`,
      },
      { status: 201 }
    );
  }

  const result = await chargeWalletUsage({
    userSub: project.ownerUserId,
    amount: quote.amount,
    reason: quote.reason,
    idempotencyKey: body.idempotencyKey,
    projectId: id,
    metadata: meta,
  });

  const baseData = {
    projectId: id,
    userSub: project.ownerUserId,
    amount: quote.amount,
    action: quote.action,
    provider: quote.provider,
  };

  if (!result.ok) {
    if (result.code === "INSUFFICIENT_BALANCE") {
      const ref = await prisma.generationChargeRef.upsert({
        where: { jobId: body.idempotencyKey },
        create: { ...baseData, jobId: body.idempotencyKey, status: "INSUFFICIENT_BALANCE" },
        update: { status: "INSUFFICIENT_BALANCE", transactionId: null, amount: quote.amount },
      });
      const required = result.required ?? quote.amount;
      await prisma.project.update({
        where: { id },
        data: {
          statusNote: `余额不足:需要 ${required} Credits 才能继续生成,请充值后重试`,
        },
      });
      // 与 set-status 一致:写完 statusNote 后推 SSE,否则前端要等到下次轮询才看到横幅
      emitProjectUpdate(id, "project.updated");
      return Response.json(
        {
          error: "Insufficient balance",
          code: "INSUFFICIENT_BALANCE",
          balance: result.balance,
          required,
          quote,
          ref,
          consumption: consumptionFromRef(ref, {
            units: quote.units,
            unitPrice: quote.unitPrice,
            reason: quote.reason,
            balance: result.balance ?? null,
          }),
          submitHint: `charged=0; error=INSUFFICIENT_BALANCE; required=${required}; balance=${result.balance ?? "?"}`,
        },
        { status: 402 }
      );
    }
    await prisma.generationChargeRef.upsert({
      where: { jobId: body.idempotencyKey },
      create: { ...baseData, jobId: body.idempotencyKey, status: "ERROR" },
      update: { status: "ERROR", transactionId: null, amount: quote.amount },
    });
    return Response.json(
      {
        error: result.message ?? "Charge failed",
        code: result.code,
        quote,
        submitHint: `charged=0; error=${result.code}`,
      },
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
    update: {
      status: "SUCCESS",
      transactionId: result.transactionId,
      amount: quote.amount,
      action: quote.action,
      provider: quote.provider,
    },
  });

  return Response.json(
    {
      ref,
      balance: result.balance,
      idempotent: result.idempotent,
      quote,
      consumption: consumptionFromRef(ref, {
        units: quote.units,
        unitPrice: quote.unitPrice,
        reason: quote.reason,
        balance: result.balance,
        idempotent: result.idempotent,
      }),
      submitHint: `charged=${quote.amount}; action=${quote.action}; units=${quote.units}; txn=${result.transactionId}; balance_after=${result.balance}`,
    },
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
