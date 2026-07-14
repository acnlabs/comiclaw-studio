// AgentPlanet 积分支付对接层(预留)。
//
// 目标流程:客户授权付费角色时,从客户的 AgentPlanet 钱包扣除积分,
// 入账到角色所属智能体(acnAgentId)的钱包。
//
// 待与 AgentPlanet 后端确认的两个接口后接通:
//   1. 扣款/转账端点(candidates: /api/services/consume、/api/users/{id}/charges)
//   2. Studio 的服务方身份(INTERNAL_API_TOKEN 或注册为平台服务)
//
// 配置(环境变量):
//   AGENTPLANET_API_URL       如 https://api.agentplanet.org
//   AGENTPLANET_INTERNAL_TOKEN Studio 调用 AgentPlanet 的内部令牌

export interface ChargeResult {
  ok: boolean;
  reason?: "NOT_CONFIGURED" | "NOT_IMPLEMENTED" | "INSUFFICIENT" | "ERROR";
}

export async function chargePointsForCasting(args: {
  payerSub: string; // 付款客户(Auth0 sub)
  payeeAcnAgentId: string | null; // 收款智能体
  points: number;
  memo: string;
}): Promise<ChargeResult> {
  const base = process.env.AGENTPLANET_API_URL;
  const token = process.env.AGENTPLANET_INTERNAL_TOKEN;
  if (!base || !token) return { ok: false, reason: "NOT_CONFIGURED" };

  // TODO(对接): 调用 AgentPlanet 扣积分/入账钱包接口
  console.warn("[agentplanet] charge not implemented:", args.memo);
  return { ok: false, reason: "NOT_IMPLEMENTED" };
}
