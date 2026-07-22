import { withStudioOrAcnAgentAuth, parseBody } from "@/lib/api";
import { badRequest } from "@/lib/auth";
import { pricingQuoteSchema } from "@/lib/schemas";
import { listPriceCard, quoteCharge } from "@/lib/pricing";

// 价目表 + 报价(工人算价预览用;真正扣款仍走 projects/:id/charge)
// 任意有效 ACN agent 或 STUDIO_API_KEY 可读(无项目绑定)
export const GET = withStudioOrAcnAgentAuth(async () => {
  return Response.json({ prices: listPriceCard(), currency: "credits" });
});

export const POST = withStudioOrAcnAgentAuth(async (req) => {
  const body = await parseBody(req, pricingQuoteSchema);
  try {
    const quote = quoteCharge({
      action: body.action,
      units: body.units,
      provider: body.provider,
    });
    return Response.json({ quote });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : String(err));
  }
});
