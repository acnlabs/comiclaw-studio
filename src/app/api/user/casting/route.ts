import { after } from "next/server";
import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { storeConfigured, createCastingOrder } from "@/lib/agentplanet";
import { grantLicense, reconcilePendingLicenses } from "@/lib/casting";
import { syncCharacterListing } from "@/lib/characterListing";
import { unauthorized, badRequest, notFoundJson } from "@/lib/auth";
import type { AgentCharacter } from "@prisma/client";

// 授权:把角色市场的数字人添加到自己的项目角色库。
// 免费即时授予;付费经 AgentPlanet Store 下单,客户用 Credits 支付后
// 调 /api/user/casting/confirm 落授权。
export async function POST(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const body = await req.json().catch(() => null);
  const { characterId, projectId } = body ?? {};
  if (typeof characterId !== "string" || !characterId) return badRequest("`characterId` is required");
  if (typeof projectId !== "string" || !projectId) return badRequest("`projectId` is required");

  const [character, project] = await Promise.all([
    prisma.agentCharacter.findUnique({ where: { id: characterId } }),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, ownerUserId: true },
    }),
  ]);
  if (!character || !character.isPublic) return notFoundJson("Character not found");
  if (!project) return notFoundJson("Project not found");
  // 只能添加到自己名下的项目
  if (project.ownerUserId !== sub) {
    return Response.json({ error: "Not your project" }, { status: 403 });
  }
  // 主人自己的角色随时可加;他人角色需开放参演
  const isOwnCharacter = character.ownerUserId != null && character.ownerUserId === sub;
  if (!isOwnCharacter && !character.openForCasting) {
    return Response.json({ error: "Character not open for casting" }, { status: 403 });
  }

  const existing = await prisma.castingLicense.findUnique({
    where: { characterId_projectId: { characterId, projectId } },
  });
  if (existing?.status === "GRANTED") {
    return Response.json({ license: existing, alreadyLicensed: true });
  }

  const points = isOwnCharacter ? 0 : character.licensePoints;

  // ---- 付费授权:经 AgentPlanet Store 下单,客户去 checkout 用 Credits 支付 ----
  if (points > 0) {
    if (!storeConfigured()) {
      return Response.json(
        { error: "Credits payment channel not available yet", code: "NOT_CONFIGURED" },
        { status: 402 }
      );
    }
    const productId = await ensureListing(character);
    if (!productId) {
      return Response.json(
        { error: "Character is not listed on the store yet", code: "NOT_LISTED" },
        { status: 402 }
      );
    }
    // Store 侧只接受 https 的 return_url;本地开发(http)不传,不影响下单
    const origin = new URL(req.url).origin;
    const returnUrl = origin.startsWith("https://")
      ? `${origin}/casting/return?characterId=${encodeURIComponent(characterId)}&projectId=${encodeURIComponent(projectId)}`
      : undefined;
    const order = await createCastingOrder({ storeProductId: productId, projectId, returnUrl });
    if (!order) {
      return Response.json(
        { error: "Failed to create store order", code: "ORDER_FAILED" },
        { status: 502 }
      );
    }
    // 占位授权记录(PENDING_PAYMENT);重复点击会开新单并覆盖旧单(旧单自然过期)
    const license = await prisma.castingLicense.upsert({
      where: { characterId_projectId: { characterId, projectId } },
      create: {
        characterId,
        projectId,
        licenseeSub: sub,
        points,
        status: "PENDING_PAYMENT",
        storeOrderId: order.order_id,
      },
      update: { licenseeSub: sub, points, storeOrderId: order.order_id },
    });
    return Response.json(
      {
        license,
        pendingPayment: true,
        orderId: order.order_id,
        checkoutUrl: order.url,
        credits: order.amount_credits,
      },
      { status: 402 }
    );
  }

  // ---- 免费授权:即时授予 + 物化到项目资产库 ----
  const license = await grantLicense({ character, projectId, sub, points: 0, orderId: null });
  return Response.json({ license }, { status: 201 });
}

// 查询当前用户对某角色的已授权项目
export async function GET(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();
  const url = new URL(req.url);
  const characterId = url.searchParams.get("characterId");
  if (!characterId) return badRequest("`characterId` is required");

  const licenses = await prisma.castingLicense.findMany({
    where: { characterId, licenseeSub: sub, status: "GRANTED" },
    select: { projectId: true },
  });
  // 惰性自愈:打开选角弹窗时顺手补一遍这个客户卡住的付费授权
  after(() => reconcilePendingLicenses(sub));
  return Response.json({ projectIds: licenses.map((l) => l.projectId) });
}

// 角色尚未上架时兜底上架(如角色在 Store 接入前就已设置付费)。
// 复用 syncCharacterListing:与主路径一致地先登记产权再上架,避免兜底
// 路径产生未登记的商品。
async function ensureListing(character: AgentCharacter): Promise<string | null> {
  if (character.storeProductId) return character.storeProductId;
  if (!character.acnAgentId) return null; // 无收款方,无法上架
  const synced = await syncCharacterListing(character);
  return synced?.storeProductId ?? null;
}
