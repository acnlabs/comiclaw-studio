import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { acceptCastingOrder, getCheckout } from "@/lib/agentplanet";
import { grantAssetLicense } from "@/lib/assetLicenseGrant";
import { conflict, forbidden, notFoundJson, unauthorized } from "@/lib/auth";
import { mapError, parseBody } from "@/lib/api";

const confirmSchema = z.object({
  assetId: z.string().trim().min(1).max(64),
  projectId: z.string().trim().min(1).max(64),
});

/**
 * Settle a paid licence after the buyer pays in Credits on AgentPlanet.
 *
 * Studio verifies the order with the Store rather than trusting the caller,
 * then grants and accepts delivery so the seller actually gets paid.
 */
export async function POST(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  let body: z.infer<typeof confirmSchema>;
  try {
    body = await parseBody(req, confirmSchema);
  } catch (err) {
    return mapError(err);
  }

  const license = await prisma.assetLicense.findUnique({
    where: {
      assetId_projectId: { assetId: body.assetId, projectId: body.projectId },
    },
    include: {
      asset: { select: { id: true, name: true, description: true, type: true } },
      project: { select: { visibility: true } },
    },
  });
  if (!license) return notFoundJson("License not found");
  if (license.licenseeSub !== sub) return forbidden("Not your license");
  if (license.status === "GRANTED") {
    return Response.json({ license, alreadyLicensed: true });
  }
  if (!license.storeOrderId) {
    return conflict("No store order for this license");
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
    return Response.json(
      {
        error: `Order is ${checkout.state}; please start over`,
        code: "ORDER_DEAD",
        state: checkout.state,
      },
      { status: 409 }
    );
  }
  // The payer must be this account. An unfilled buyer_id is not waved through:
  // that would rest on the Store's internals staying as they are today.
  if (!checkout.buyer_id || checkout.buyer_id !== sub) {
    return forbidden("Order was paid by another account");
  }

  const granted = await grantAssetLicense({
    asset: license.asset,
    projectId: license.projectId,
    projectVisibility: license.project.visibility,
    sub,
    points: checkout.amount_credits,
    orderId: license.storeOrderId,
  });
  if (!granted.ok) {
    return conflict(
      granted.reason === "withdrawn"
        ? "This asset is no longer published"
        : "Licensing is in progress, try again"
    );
  }
  // Delivery accepted → the Store settles: platform fee out, seller paid.
  // best effort; the acceptance window sweeps anything left behind.
  await acceptCastingOrder(license.storeOrderId, sub);

  return Response.json({ license: granted.license }, { status: 201 });
}
