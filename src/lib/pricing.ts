// Studio 内部价目表(Credits)。权威扣款仍走 AgentPlanet /wallet/charge;
// 这里只给建单提示与生产侧算价用,不是第二套账本。

export type ChargeAction =
  | "script_gen"
  | "asset_generate"
  | "shot_generate"
  | "video_generate"
  | "post_production";

/** 各动作默认 Credits 单价(整数);可按需用环境变量覆盖 */
export const CREDIT_PRICES: Record<ChargeAction, number> = {
  script_gen: Number(process.env.PRICE_SCRIPT_GEN ?? 0), // 写剧本默认免费(算力另计聊天)
  asset_generate: Number(process.env.PRICE_ASSET_GENERATE ?? 5),
  shot_generate: Number(process.env.PRICE_SHOT_GENERATE ?? 8),
  video_generate: Number(process.env.PRICE_VIDEO_GENERATE ?? 30),
  post_production: Number(process.env.PRICE_POST_PRODUCTION ?? 10),
};

export function priceForAction(action: ChargeAction): number {
  const n = CREDIT_PRICES[action];
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}
