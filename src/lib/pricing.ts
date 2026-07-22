// Studio 内部价目表(Credits)。权威扣款仍走 AgentPlanet /wallet/charge;
// 工人只上报 action + units,金额由这里算——不是第二套账本。

export type ChargeAction =
  | "script_gen"
  | "asset_generate"
  | "shot_generate"
  | "video_generate"
  | "post_production";

/** 各动作每单位 Credits 单价(整数);可用环境变量覆盖 */
export const CREDIT_UNIT_PRICES: Record<ChargeAction, number> = {
  // 写剧本默认免费(对话算力另计);units 仍接受但不向钱包扣款
  script_gen: Number(process.env.PRICE_SCRIPT_GEN ?? 0),
  // 出设定图:units = 图片张数
  asset_generate: Number(process.env.PRICE_ASSET_GENERATE ?? 5),
  // 分镜参考帧/镜头图:units = 张数
  shot_generate: Number(process.env.PRICE_SHOT_GENERATE ?? 8),
  // 视频生成:units = 秒(向上取整后由调用方传入整数秒)
  video_generate: Number(process.env.PRICE_VIDEO_GENERATE ?? 30),
  // 后期/合成:units = 次数
  post_production: Number(process.env.PRICE_POST_PRODUCTION ?? 10),
};

const MAX_CHARGE_AMOUNT = 100_000;
const MAX_UNITS = 10_000;

export function unitPriceForAction(action: ChargeAction): number {
  const n = CREDIT_UNIT_PRICES[action];
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export interface ChargeQuote {
  action: ChargeAction;
  units: number;
  unitPrice: number;
  amount: number;
  provider: string | null;
  reason: string;
  billable: boolean; // amount > 0 才需要打 AgentPlanet
}

export function quoteCharge(args: {
  action: ChargeAction;
  units: number;
  provider?: string | null;
  reason?: string | null;
}): ChargeQuote {
  const units = Math.floor(args.units);
  if (!Number.isFinite(units) || units < 1 || units > MAX_UNITS) {
    throw new Error(`units must be an integer in 1..${MAX_UNITS}`);
  }
  const unitPrice = unitPriceForAction(args.action);
  const amount = unitPrice * units;
  if (amount > MAX_CHARGE_AMOUNT) {
    throw new Error(`quoted amount ${amount} exceeds max ${MAX_CHARGE_AMOUNT}`);
  }
  const provider = args.provider?.trim() || null;
  const reason =
    args.reason?.trim() ||
    `${args.action}:${provider ?? "default"}:u${units}`;
  return {
    action: args.action,
    units,
    unitPrice,
    amount,
    provider,
    reason: reason.slice(0, 200),
    billable: amount > 0,
  };
}

export function listPriceCard(): Array<{
  action: ChargeAction;
  unitPrice: number;
  unit: string;
}> {
  return [
    { action: "script_gen", unitPrice: unitPriceForAction("script_gen"), unit: "request" },
    { action: "asset_generate", unitPrice: unitPriceForAction("asset_generate"), unit: "image" },
    { action: "shot_generate", unitPrice: unitPriceForAction("shot_generate"), unit: "image" },
    { action: "video_generate", unitPrice: unitPriceForAction("video_generate"), unit: "second" },
    { action: "post_production", unitPrice: unitPriceForAction("post_production"), unit: "job" },
  ];
}
