import { z } from "zod";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import {
  badRequest,
  conflict,
  forbidden,
  notFoundJson,
  unauthorized,
} from "@/lib/auth";
import { mapError, parseBody } from "@/lib/api";
import {
  acceptCastingOrder,
  checkoutUrl,
  createCastingOrder,
  getAssetRegistration,
  getCharacterListing,
  getCheckout,
  storeConfigured,
} from "@/lib/agentplanet";
import { checkLicensable } from "@/lib/assetLicense";
import {
  grantAssetLicense,
  reconcilePendingAssetLicenses,
} from "@/lib/assetLicenseGrant";
import { assetKindFor } from "@/lib/assetPublish";
import { controlsAsset } from "@/lib/assetTransfer";
import { governedOrgIds } from "@/lib/orgGovernance";

const licenseSchema = z.object({
  assetId: z.string().trim().min(1).max(64),
  projectId: z.string().trim().min(1).max(64),
});

const REFUSALS: Record<string, string> = {
  not_published: "This asset is not published",
  no_pinned_version: "This asset has no published version yet",
  not_your_project: "You can only license into your own project",
  already_licensed: "Already licensed into this project",
};

/**
 * License a published asset into one of your projects.
 *
 * Free assets are granted on the spot. Priced ones go through an AgentPlanet
 * Store order: the buyer pays in Credits and the licence lands on confirmation,
 * or on the next lazy reconcile if they never come back.
 *
 * Either way the licensee gets a copy of the pinned version — something their
 * pipeline can iterate on — while ownership of the original stays put.
 */
export async function POST(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  let body: z.infer<typeof licenseSchema>;
  try {
    body = await parseBody(req, licenseSchema);
  } catch (err) {
    return mapError(err);
  }

  const [asset, project] = await Promise.all([
    prisma.asset.findUnique({
      where: { id: body.assetId },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        publishState: true,
        publishedVersionId: true,
        licensePoints: true,
        storeProductId: true,
        ownerType: true,
        ownerId: true,
      },
    }),
    prisma.project.findUnique({
      where: { id: body.projectId },
      select: { id: true, ownerUserId: true, visibility: true },
    }),
  ]);
  if (!asset) return notFoundJson("Asset not found");
  if (!project) return notFoundJson("Project not found");

  const existing = await prisma.assetLicense.findUnique({
    where: { assetId_projectId: { assetId: asset.id, projectId: project.id } },
  });
  if (existing?.status === "GRANTED") {
    return Response.json({ license: existing, alreadyLicensed: true });
  }

  const check = checkLicensable({
    publishState: asset.publishState,
    publishedVersionId: asset.publishedVersionId,
    projectOwnerUserId: project.ownerUserId,
    requesterSub: sub,
    existingStatus: existing?.status ?? null,
  });
  if (!check.ok) {
    const message = REFUSALS[check.reason] ?? "Cannot license this asset";
    if (check.reason === "not_your_project") return forbidden(message);
    if (check.reason === "already_licensed") return conflict(message);
    return badRequest(message);
  }

  // Your own asset (or your Org's) costs nothing to use in your own project.
  const isOwn =
    asset.ownerType && asset.ownerId
      ? controlsAsset({
          owner: { type: asset.ownerType as "user" | "agent" | "org", id: asset.ownerId },
          actor: { type: "user", id: sub },
          governs: await governedOrgIds(sub),
        })
      : false;
  const points = isOwn ? 0 : asset.licensePoints;

  if (points > 0) {
    return startPaidLicense({ req, sub, asset, projectId: project.id, points, existing });
  }

  const granted = await grantAssetLicense({
    asset,
    projectId: project.id,
    projectVisibility: project.visibility,
    sub,
    points: 0,
    orderId: null,
  });
  if (!granted.ok) {
    return conflict(
      granted.reason === "withdrawn"
        ? "This asset is no longer published"
        : "Licensing is in progress, try again"
    );
  }
  return Response.json({ license: granted.license }, { status: 201 });
}

type PricedAsset = {
  id: string;
  name: string;
  type: string;
  storeProductId: string | null;
  ownerType: string | null;
  ownerId: string | null;
};

/**
 * Open (or reuse) a Store order for a paid licence.
 *
 * Reusing a live order matters: a buyer with two tabs could otherwise pay an
 * order Studio has forgotten, and the money would settle to the seller while
 * the licence never lands.
 */
async function startPaidLicense(args: {
  req: Request;
  sub: string;
  asset: PricedAsset;
  projectId: string;
  points: number;
  existing: { status: string; storeOrderId: string | null } | null;
}): Promise<Response> {
  const { req, sub, asset, projectId, points, existing } = args;

  if (!storeConfigured()) {
    return Response.json(
      { error: "Credits payment channel not available yet", code: "NOT_CONFIGURED" },
      { status: 402 }
    );
  }

  if (existing?.status === "PENDING_PAYMENT" && existing.storeOrderId) {
    const checkout = await getCheckout(existing.storeOrderId);
    if (checkout?.state === "pending") {
      return Response.json(
        {
          pendingPayment: true,
          orderId: existing.storeOrderId,
          checkoutUrl: checkoutUrl(existing.storeOrderId),
          credits: checkout.amount_credits,
        },
        { status: 402 }
      );
    }
    if (
      checkout &&
      (checkout.state === "fulfilling" || checkout.state === "completed") &&
      (!checkout.buyer_id || checkout.buyer_id === sub)
    ) {
      // Already paid — the buyer just never confirmed. Land it now instead of
      // sending them through checkout a second time.
      const project = await prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { visibility: true },
      });
      const full = await prisma.asset.findUniqueOrThrow({
        where: { id: asset.id },
        select: { id: true, name: true, description: true, type: true },
      });
      const granted = await grantAssetLicense({
        asset: full,
        projectId,
        projectVisibility: project.visibility,
        sub,
        points: checkout.amount_credits,
        orderId: existing.storeOrderId,
      });
      if (!granted.ok) return conflict("This asset is no longer published");
      await acceptCastingOrder(existing.storeOrderId, sub);
      return Response.json({ license: granted.license }, { status: 201 });
    }
    // cancelled / expired / refunded, or a different buyer: the old order is
    // dead, fall through and open a new one.
  }

  const productId = await confirmedListing(asset);
  if (!productId) {
    return Response.json(
      { error: "This asset is not on sale right now", code: "NOT_LISTED" },
      { status: 402 }
    );
  }

  // The Store only accepts https return urls; local http dev skips it.
  const origin = new URL(req.url).origin;
  const returnUrl = origin.startsWith("https://")
    ? `${origin}/license/return?assetId=${encodeURIComponent(asset.id)}&projectId=${encodeURIComponent(projectId)}`
    : undefined;
  const order = await createCastingOrder({ storeProductId: productId, projectId, returnUrl });
  if (!order) {
    return Response.json(
      { error: "Failed to create store order", code: "ORDER_FAILED" },
      { status: 502 }
    );
  }

  const license = await prisma.assetLicense.upsert({
    where: { assetId_projectId: { assetId: asset.id, projectId } },
    create: {
      assetId: asset.id,
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

/**
 * Confirm the asset is really on sale — read only.
 *
 * A buyer's click must not write to the seller's product: re-running the
 * listing sync here would flip `is_active` back on for something the seller or
 * a reviewer took down, and overwrite its name and price along the way.
 */
async function confirmedListing(asset: PricedAsset): Promise<string | null> {
  if (!asset.storeProductId || !asset.ownerType || !asset.ownerId) return null;

  const kind = assetKindFor(asset.type);
  if (!kind) return null;

  const [registration, listing] = await Promise.all([
    getAssetRegistration(kind, asset.id),
    getCharacterListing(asset.storeProductId),
  ]);
  if (!registration) return null;
  // Seller and registry owner must agree or the order is refused at the Store.
  if (
    registration.owner_type !== asset.ownerType ||
    registration.owner_id !== asset.ownerId
  ) {
    return null;
  }
  if (!listing?.is_active || listing.review_status === "rejected") return null;
  return asset.storeProductId;
}

/** Which of my projects already have this asset licensed. */
export async function GET(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const url = new URL(req.url);
  const assetId = url.searchParams.get("assetId")?.trim();
  if (!assetId) return badRequest("`assetId` is required");

  const licenses = await prisma.assetLicense.findMany({
    where: { assetId, licenseeSub: sub, status: "GRANTED" },
    select: { projectId: true },
  });

  // Settle anything this buyer paid for but never confirmed, while they are here.
  after(() => reconcilePendingAssetLicenses(sub));

  return Response.json({ projectIds: licenses.map((l) => l.projectId) });
}
