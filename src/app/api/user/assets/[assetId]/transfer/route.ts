import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { conflict, notFoundJson, unauthorized } from "@/lib/auth";
import { mapError, parseBody } from "@/lib/api";
import { checkTransfer } from "@/lib/assetTransfer";
import { managedByCharacter } from "@/lib/assetPublish";
import { refuseTransfer, runTransfer } from "@/lib/assetTransferFlow";
import { governedOrgIds } from "@/lib/orgGovernance";

/**
 * Hand a published asset to one of your Orgs, or take one back.
 *
 * A human's entitlement comes from the columns they own: creating a column's
 * Org through Studio is what makes them its governor, so those Orgs are both
 * the ones they may give assets to and the ones they may take assets out of.
 */

type Ctx = { params: Promise<{ assetId: string }> };

const transferSchema = z.object({
  /** Omit to take the asset back into your own name. */
  orgId: z.string().trim().min(1).max(128).optional(),
});

export async function POST(req: Request, ctx: Ctx) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const { assetId: rawId } = await ctx.params;
  const assetId = rawId?.trim();
  if (!assetId) return notFoundJson();

  let body: z.infer<typeof transferSchema>;
  try {
    body = await parseBody(req, transferSchema);
  } catch (err) {
    return mapError(err);
  }

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      type: true,
      publishState: true,
      ownerType: true,
      ownerId: true,
      character: { select: { id: true } },
    },
  });
  if (!asset) return notFoundJson("Asset not found");
  if (managedByCharacter(asset)) {
    return conflict(
      "This asset backs a marketplace character; transfer it on the character instead"
    );
  }

  const orgIds = await governedOrgIds(sub);

  const move = checkTransfer({
    asset,
    actor: { type: "user", id: sub },
    entitlement: { putInto: orgIds, takeFrom: orgIds },
    target: body.orgId ? { kind: "org", orgId: body.orgId } : { kind: "self" },
  });
  if (!move.ok) return refuseTransfer(move.reason);

  return runTransfer({ asset, move });
}
