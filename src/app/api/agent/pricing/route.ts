import { withAgentAuth, parseBody } from "@/lib/api";
import { badRequest } from "@/lib/auth";
import { pricingQuoteSchema } from "@/lib/schemas";
import { listPriceCard, quoteCharge } from "@/lib/pricing";

// 价目表 + 报价(工人算价预览用;真正扣款仍走 projects/:id/charge)
export const GET = withAgentAuth(async () => {
  return Response.json({ prices: listPriceCard(), currency: "credits" });
});

export const POST = withAgentAuth(async (req) => {
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
