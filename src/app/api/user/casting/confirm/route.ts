import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { getCheckout, acceptCastingOrder } from "@/lib/agentplanet";
import { grantLicense } from "@/lib/casting";
import { unauthorized, badRequest, notFoundJson } from "@/lib/auth";

// 付费授权的支付确认:客户在 AgentPlanet checkout 用 Credits 付款后回来调用。
// Studio 向 Store 核实订单已支付(且买家是本人)→ 落授权 → 确认收货放款。
export async function POST(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const body = await req.json().catch(() => null);
  const { characterId, projectId } = body ?? {};
  if (typeof characterId !== "string" || !characterId) return badRequest("`characterId` is required");
  if (typeof projectId !== "string" || !projectId) return badRequest("`projectId` is required");

  const license = await prisma.castingLicense.findUnique({
    where: { characterId_projectId: { characterId, projectId } },
    include: { character: true },
  });
  if (!license) return notFoundJson("License not found");
  if (license.licenseeSub !== sub) {
    return Response.json({ error: "Not your license" }, { status: 403 });
  }
  if (license.status === "GRANTED") {
    return Response.json({ license, alreadyLicensed: true });
  }
  if (!license.storeOrderId) {
    return Response.json({ error: "No store order for this license" }, { status: 409 });
  }

  const checkout = await getCheckout(license.storeOrderId);
  if (!checkout) {
    return Response.json(
      { error: "Failed to query store order", code: "STORE_UNAVAILABLE" },
      { status: 502 }
    );
  }
  if (checkout.state === "pending") {
    return Response.json(
      { error: "Order not paid yet", code: "NOT_PAID", state: checkout.state },
      { status: 402 }
    );
  }
  if (checkout.state !== "fulfilling" && checkout.state !== "completed") {
    // cancelled / expired / refunded:让客户重新发起
    return Response.json(
      { error: `Order is ${checkout.state}; please start over`, code: "ORDER_DEAD", state: checkout.state },
      { status: 409 }
    );
  }
  // 买家须是本人(在 AgentPlanet 用同一 Auth0 账号支付)。ap-backend 的不变量是
  // state ∈ {fulfilling, completed} 时 buyer_id 必已回填,但这里按「未回填也不放行」
  // 处理(而不是 buyer_id 为空就跳过校验),做纵深防御,不依赖对方内部实现细节。
  if (!checkout.buyer_id || checkout.buyer_id !== sub) {
    return Response.json({ error: "Order was paid by another account" }, { status: 403 });
  }

  const granted = await grantLicense({
    character: license.character,
    projectId,
    sub,
    points: checkout.amount_credits,
    orderId: license.storeOrderId,
  });
  // 授权已落地 → 确认收货,Store 立即结算(平台抽佣后进卖家智能体钱包)。
  // best effort:失败由验收窗超时 sweep 兜底。
  await acceptCastingOrder(license.storeOrderId, sub);

  return Response.json({ license: granted }, { status: 201 });
}
